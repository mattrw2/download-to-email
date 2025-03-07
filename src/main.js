import { createWriteStream, readFileSync } from "fs"
import { chromium } from "playwright"
import { createTransport } from "nodemailer"
import { pdfOptions } from "./config.js"
import { api } from "./ganttClient.js"
import dotenv from "dotenv"
import axios from "axios"
import fs from "fs"
dotenv.config()

const getPdfUrl = (projects) => {
  if (!projects) {
    throw new Error("No projects specified")
  }

  const baseUrl = "https://prod.teamgantt.com/gantt/export/pdf/?"
  // today is required for the nice vertical yellow line in the PDF
  const today = new Date().toISOString().split("T")[0]
  const params = new URLSearchParams({
    ...pdfOptions,
    projects,
    user_date: today
  })
  return `${baseUrl}${params}`
}

const collapseRootGroups = async (projects) => {
  try {
    console.log(`Collapsing root groups for projects: ${projects}`)
    const groups = await api(`groups?project_ids=${projects}`)

    const data = groups
      .filter((g) => g.parent_group_id == null)
      .map((g) => {
        return {
          id: g.id,
          collapsed: true
        }
      })
    // returns a 403 if user is a collaborator even though it works in the UI
    await api("groups", { method: "PATCH", payload: { data } })
  } catch (error) {
    console.error("Error collapsing root groups:", error.message)
    throw error
  }
}

const downloadPDF = async (cookie, projects) => {
  try {
    console.log(`Downloading PDF for projects: ${projects}`)
    // await collapseRootGroups(projects) TODO: need admin credentials
    const url = getPdfUrl(projects)

    const headers = {
      Cookie: cookie,
      "Content-Type": "application/pdf"
    }

    const response = await axios.get(url, {
      headers,
      responseType: "stream",
      maxRedirects: 0
    })

    const timeStamp = new Date().toISOString()

    const outputPath = `./reports/${projects}-${timeStamp}.pdf`

    const writer = createWriteStream(outputPath)
    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on("finish", () => resolve(outputPath))
      writer.on("error", reject)
    })
  } catch (error) {
    console.error(
      `Error downloading PDF for projects: ${projects}:`,
      error.message
    )
    throw error
  }
}

const emailPdf = async (to, filePath) => {
  try {
    console.log(`Emailing PDF at location ${filePath} to ${to}`)
    const transporter = createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    })

    const content = readFileSync(filePath)

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject: "Your Project Report",
      attachments: [
        {
          filename: "report.pdf",
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
    console.log(`Getting cookie for ${process.env.TEAMGANTT_USER}`)
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()

    // Navigate to TeamGantt login page
    await page.goto("https://app.teamgantt.com/my-projects/active/pages/1")

    // Fill in the login form
    await page.fill('input[name="email"]', process.env.TEAMGANTT_USER)
    await page.fill('input[name="password"]', process.env.TEAMGANTT_PASSWORD)

    // Click the login button
    await page.click('input[type="submit"]')

    // Wait for the login to complete
    await page.waitForURL(
      "https://app.teamgantt.com/my-projects/active/pages/1",
      { timeout: 30000 }
    )

    const cookies = await page.context().cookies()
    const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ")

    await browser.close()

    return cookie
  } catch (error) {
    console.error("Error getting cookie:", error.message)
    throw error
  }
}

const main = async (isSimulated = false) => {
  const cookie = await getCookie()
  const rawAccountsData = fs.readFileSync("./src/accounts.json")
  const accounts = JSON.parse(rawAccountsData)
  // for each account, send the email
  for (const account of accounts) {
    const filePath = await downloadPDF(cookie, account.project)

    if (isSimulated) {
      console.log(
        `This is a dry run: skipping emailing PDF at location ${filePath} to ${account.email}`
      )
      continue
    }

    await emailPdf(account.email, filePath)
  }
}

if (process.argv[1] === import.meta.filename) {
  const isSimulated = process.argv.includes("simulateOnly")
  main(isSimulated)
}

export { main }
