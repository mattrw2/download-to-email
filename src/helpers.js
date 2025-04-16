import fs from "fs"
import { logFileName } from "./config.js"
import { pdfOptions } from "./config.js"

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
    return { project, email, date }
  })
}

const logSentMail = (project, email, filePath) => {
  const logPath = `./${logFileName}.csv`
  if (!fs.existsSync(logPath)) {
    const header = "project,email,date\n"
    fs.writeFileSync(logPath, header)
  }

  const logData = `${project},${email},${filePath.split("_")[1].split(".")[0]}\n`
  fs.appendFileSync(logPath, logData)
}

const getAccountsData = () => {
  const accountsPath = "./src/accounts.json"
  if (!fs.existsSync(accountsPath)) {
    throw new Error("No accounts file found")
  }

  const accountsData = fs.readFileSync(accountsPath, "utf-8")
  return JSON.parse(accountsData)
}

export { getPdfUrl, getSentMails, logSentMail, getAccountsData }
