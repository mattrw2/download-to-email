import { createWriteStream, readFileSync } from "fs"
import { chromium } from "playwright"
import { createTransport } from "nodemailer"
import { emailFileName } from "./config.js"
import dotenv from "dotenv"
import axios from "axios"
import fs from "fs"
import { join } from "path"
import minimist from "minimist"
import handlebars from "handlebars"
import { collapseRootGroups, getRootGroups } from "./api.js"
import {
  getAccountsData,
  getPdfUrl,
  getSentMails,
  logSentMail,
  notifyTeams
} from "./helpers.js"
dotenv.config()

function loadTemplate(data) {
  const templatePath = join(import.meta.dirname, "email.html")
  const templateContent = fs.readFileSync(templatePath, "utf8")
  const template = handlebars.compile(templateContent)
  return template(data)
}

const downloadPDF = async (cookie, teamgantt_project_id, date) => {
  await collapseRootGroups(teamgantt_project_id)
  const url = getPdfUrl(teamgantt_project_id)

  const headers = {
    Cookie: cookie,
    "Content-Type": "application/pdf"
  }

  const response = await axios.get(url, {
    headers,
    responseType: "stream",
    maxRedirects: 0
  })

  // Create the reports directory if it doesn't exist
  if (!fs.existsSync("./reports")) {
    fs.mkdirSync("./reports")
  }

  const outputPath = `./reports/${teamgantt_project_id}_${date}.pdf`

  const writer = createWriteStream(outputPath)
  response.data.pipe(writer)

  const output = await new Promise((resolve, reject) => {
    writer.on("finish", () => {
      try {
        const stats = fs.statSync(outputPath)
        if (stats.size === 0) {
          fs.unlinkSync(outputPath)
          return reject(
            new Error(
              `Downloaded file is empty. project ${teamgantt_project_id} may not exist`
            )
          )
        }
        return resolve(outputPath)
      } catch (error) {
        reject(error)
      }
    })
    writer.on("error", reject)
  })

  // check to make sure groups are still collapsed
  const groups = await getRootGroups(teamgantt_project_id)
  groups.forEach((group) => {
    if (!group.is_collapsed) {
      throw new Error(`Project ${teamgantt_project_id} has expanded groups`)
    }
  })

  return output
}

const emailPdf = async (filePath, data) => {
  try {
    const transporter = createTransport({
      host: process.env.EMAIL_HOST ?? "smtp.office365.com",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    })

    const content = readFileSync(filePath)

    const html = loadTemplate(data)
    const subject = `Projektupdate: ${data.project_number} ${data.project_name}`

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: data.email,
      cc: data.cc,
      subject,
      html,
      attachments: [
        {
          filename: `${emailFileName}.pdf`,
          content
        }
      ]
    }

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error.message)
        throw error
      }
    })
  } catch (error) {
    console.error("Error sending email:", error.message)
    throw error
  }
}

const getCookie = async () => {
  try {
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()

    // Navigate to TeamGantt login page
    await page.goto("https://app.teamgantt.com")

    // Fill in the login form
    await page.fill('input[name="email"]', process.env.TEAMGANTT_USER)
    await page.fill('input[name="password"]', process.env.TEAMGANTT_PASSWORD)

    // Click the login button
    await page.click('input[type="submit"]')

    // Wait for the login to complete
    await page.waitForURL("https://app.teamgantt.com", { timeout: 30000 })

    const cookies = await page.context().cookies()
    const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ")

    await browser.close()

    return cookie
  } catch (error) {
    console.error("Error getting cookie:", error.message)
    throw error
  }
}

/**
 * Main entry point for processing and sending account-related PDFs.
 *
 * @param {Object} options - The options object.
 * @param {boolean} options.simulate - If true, simulate actions without making changes.
 * @param {string} options.date - The date to use for processing (format: YYYY-MM-DD).
 * @param {Array} options.accounts - List of accounts to process.
 * @param {Function} options.getCookie - Function that returns an auth cookie string.
 * @param {Function} options.getSentMails - Function to retrieve a list of previously sent emails.
 * @param {Function} options.downloadPDF - Function that downloads the PDF for an account.
 * @param {Function} options.emailPdf - Function that sends the PDF via email.
 * @param {Function} options.logSentMail - Function that logs a successfully sent email.
 * @returns {Promise<void>} Resolves when the process is complete.
 */

const main = async ({
  simulate,
  date,
  accounts,
  getCookie,
  getSentMails,
  downloadPDF,
  emailPdf,
  logSentMail
}) => {
  console.log(
    `Running in ${
      simulate ? "simulation" : "production"
    } mode with date: ${date}`
  )
  const cookie = await getCookie()
  const sentEmails = getSentMails()

  for (const account of accounts) {
    if (!account.teamgantt_project_id || !account.email) {
      console.error("Skipping: missing project or email for account:", account)
      notifyTeams(
        `Missing project or email for account: ${JSON.stringify(account)}`
      )
      continue
    }
    console.log(
      `Processing project: ${account.teamgantt_project_id} with email: ${account.email}`
    )
    // Check if the email has already been sent for this date
    const sentEmail = sentEmails.find(
      (email) =>
        email.project === account.teamgantt_project_id &&
        email.email === account.email &&
        email.date === date
    )
    if (sentEmail) {
      console.log(
        `Skipping: email already sent for project ${account.teamgantt_project_id} to ${account.email} on ${date}`
      )
      continue
    }

    let filePath

    try {
      filePath = await downloadPDF(cookie, account.teamgantt_project_id, date)
    } catch (error) {
      console.error("Error downloading PDF", error.message)
      notifyTeams(error.message)
      continue
    }

    if (simulate) {
      console.log(
        `Skipping (simulation mode): emailing PDF at location ${filePath} to ${account.email}`
      )
      continue
    }

    try {
      await emailPdf(filePath, account)
      logSentMail(account.teamgantt_project_id, account.email, filePath)
      console.log(
        `Success: email sent successfully to ${account.email} for project ${account.teamgantt_project_id}`
      )
    } catch (error) {
      console.error(
        `Error emailing PDF at location ${filePath} to ${account.email}:`,
        error.message
      )
      throw error
    }
  }
}

if (process.argv[1] === import.meta.filename) {
  try {
    let { date, simulate } = minimist(process.argv.slice(2))

    const defaults = {
      date: new Date().toISOString().split("T")[0],
      simulate: false,
      accounts: getAccountsData(),
      getCookie,
      getSentMails,
      downloadPDF,
      emailPdf,
      logSentMail
    }

    main({
      ...defaults,
      ...(date && { date }),
      ...(simulate && { simulate })
    })
  } catch (error) {
    console.error(error.message)
    notifyTeams(error.message)
  }
}

export { main }
