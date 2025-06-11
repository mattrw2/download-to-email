import { createWriteStream, readFileSync } from "fs"
import { chromium } from "playwright"
import { createTransport } from "nodemailer"
import { emailFileName, graphAPIAppId, driveId, driveItemId } from "./config.js"
import dotenv from "dotenv"
import axios from "axios"
import fs from "fs"
import { join } from "path"
import minimist from "minimist"
import handlebars from "handlebars"
import { collapseRootGroups, getRootGroups } from "./api.js"
import {
  getCleanedAndValidatedAccounts,
  getPdfUrl,
  getSentMails,
  logSentMail,
  notifyTeams
} from "./helpers.js"
import xlsx from "xlsx"
dotenv.config()

function loadTemplate(data) {
  const templatePath = join(import.meta.dirname, "email.html")
  const templateContent = fs.readFileSync(templatePath, "utf8")
  const template = handlebars.compile(templateContent)
  return template(data)
}

const getAccounts = async () => {
  const url = `https://login.microsoftonline.com/${graphAPIAppId}/oauth2/v2.0/token`
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded"
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.GRAPH_API_CLIENT_ID,
    client_secret: process.env.GRAPH_API_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default"
  })

  const response = await axios.post(url, body, { headers })
  if (response.status !== 200) {
    throw new Error(
      `Failed to get access token: ${response.status} ${response.statusText}`
    )
  }
  const accessToken = response.data.access_token
  const itemUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${driveItemId}`

  const itemHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  }
  const itemResponse = await axios.get(itemUrl, { headers: itemHeaders })
  if (itemResponse.status !== 200) {
    throw new Error(
      `Failed to get Excel config sheet: ${itemResponse.status} ${itemResponse.statusText}`
    )
  }
  const excelFileUrl = itemResponse.data["@microsoft.graph.downloadUrl"]

  const excelResponse = await axios.get(excelFileUrl, {
    responseType: "arraybuffer"
  })
  if (excelResponse.status !== 200) {
    throw new Error(
      `Failed to download accounts: ${excelResponse.status} ${excelResponse.statusText}`
    )
  }
  const workbook = xlsx.read(excelResponse.data, { type: "buffer" })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 })

  const headerRow = data[1]
  const dataRows = data.slice(2)

  if (!data || data.length === 0) {
    throw new Error("No data found in the Excel accounts sheet")
  }

 const jsonData = dataRows.map((row) => {
    const rowData = {}
    headerRow.forEach((header, index) => {
      rowData[header] = row[index]
    })
    return rowData
  }
  )
  if (!jsonData || jsonData.length === 0) {
    throw new Error("No valid data found in the Excel config sheet")
  }

  return getCleanedAndValidatedAccounts(jsonData)
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
  getAccounts,
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
  const accounts = await getAccounts()

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
      getAccounts,
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
