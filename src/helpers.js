import fs from "fs"
import { expectedAccountSchema, logFileName } from "./config.js"
import { pdfOptions } from "./config.js"
import axios from "axios"
import validator from "validator"

const notifyTeams = async (errorMessage) => {
  if (process.env.NODE_ENV === "test") {
    console.log("Skipping Teams notification in test mode")
    return
  }

  const time = new Date().toLocaleString()

  const messageCard = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: "0076D7",
    summary: "Issue encountered when executing teamgantt-project-emailer",
    sections: [
      {
        activityTitle: `${errorMessage}`,
        markdown: true,
        facts: [
          {
            name: "Triggered at",
            value: time
          }
        ]
      }
    ]
  }

  const webhookUrl = process.env.TEAMS_WEBHOOK_URL

  if (!webhookUrl) {
    console.error("No webhook URL specified")
    return
  }

  axios.post(webhookUrl, messageCard)
}

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

const getSentMails = () => {
  const logPath = `./${logFileName}.csv`
  if (!fs.existsSync(logPath)) {
    return []
  }

  const lines = fs
    .readFileSync(logPath, "utf-8")
    .split("\n")
    .filter((line) => line.trim() !== "")

  // Skip the first line (header)
  return lines.slice(1).map((line) => {
    const [project, email, date] = line.split(",")
    return { project: parseInt(project), email, date }
  })
}

const logSentMail = (project, email, filePath) => {
  const logPath = `./${logFileName}.csv`
  if (!fs.existsSync(logPath)) {
    const header = "project,email,date\n"
    fs.writeFileSync(logPath, header)
  }

  const logData = `${project},${email},${
    filePath.split("_")[1].split(".")[0]
  }\n`
  fs.appendFileSync(logPath, logData)
}

const getCleanedAndValidatedAccount = (row) => {
  const errors = []

  for (const [key, value] of Object.entries(expectedAccountSchema)) {
    const fieldValue = row[key]
    if (value.required && !fieldValue) {
      errors.push(`Missing required field: ${key}`)
      continue
    }

    if (!value.required && !fieldValue) {
      continue
    }

    if (value.type === "string" && typeof fieldValue !== "string") {
      errors.push(`Invalid type for field ${key}: expected string`)
    } else if (value.type === "number" && typeof fieldValue !== "number") {
      errors.push(`Invalid type for field ${key}: expected number`)
    } else if (value.type === "email" && !validator.isEmail(fieldValue)) {
      errors.push(`Invalid email format for field ${key}`)
    } else if (value.type === "emailList") {
      const emails = fieldValue.split(",").map((email) => email.trim())
      for (const email of emails) {
        if (!validator.isEmail(email)) {
          errors.push(`Invalid email format in list for field ${key}: ${email}`)
        }
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(`Validation errors: ${errors.join(", ")}`)
  }
  return {
    project_number: row["project number"],
    project_name: row["project name"],
    teamgantt_project_id: row["teamgantt project id"],
    first_name: row["customer first name"],
    last_name: row["customer last name"],
    email: row["customer email"],
    cc: row["customer email cc"]
      ? row["customer email cc"].split(",").map((email) => email.trim())
      : []
  }
}

const getCleanedAndValidatedAccounts = (accounts) => {
  return accounts
    .filter((account) => account?.["project number"])
    .map((account, index) => {
      return getCleanedAndValidatedAccount(account)
    })
}

export {
  getPdfUrl,
  getSentMails,
  logSentMail,
  notifyTeams,
  getCleanedAndValidatedAccounts
}
