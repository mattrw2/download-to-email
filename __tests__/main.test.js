// test/main.test.js
import { test } from "node:test"
import { strict as assert } from "node:assert"
import { main } from "../src/index.js"

test("shouldn't email the pdf in simulation mode", async () => {
  const date = "2023-10-01"
  const simulate = true
  const mockedAccounts = [
    {
      first_name: "Matt",
      last_name: "R",
      teamgantt_project_id: "4251746",
      project_name: "PTM Mechatronics",
      project_number: "1234",
      email: "mattrw2@gmail.com",
      cc: ["mattrw2@gmail.com"]
    }
  ]

  const mockedGetCookie = () => Promise.resolve("mocked_cookie")
  const mockedGetSentMails = () => []
  const mockedDownloadPDF = () => Promise.resolve("mocked_path")
  let emailPdfCalled = false
  const mockedEmailPdf = () => {
    emailPdfCalled = true
    return Promise.resolve("mocked_email")
  }
  const mockedLogSentMail = () => {}

  await main({
    simulate,
    date,
    accounts: mockedAccounts,
    getCookie: mockedGetCookie,
    getSentMails: mockedGetSentMails,
    downloadPDF: mockedDownloadPDF,
    emailPdf: mockedEmailPdf,
    logSentMail: mockedLogSentMail
  })

  assert.strictEqual(emailPdfCalled, false)
})

test("shouldn't email the pdf if it's already been sent", async () => {
  const date = "2023-10-01"
  const simulate = false
  const mockedAccounts = [
    {
      first_name: "Matt",
      last_name: "R",
      teamgantt_project_id: "4251746",
      project_name: "PTM Mechatronics",
      project_number: "1234",
      email: "mattrw2@gmail.com",
      cc: ["mattrw2@gmail.com"]
    }
  ]

  const mockedGetCookie = () => Promise.resolve("mocked_cookie")
  const mockedGetSentMails = () => [
    {
      project: mockedAccounts[0].teamgantt_project_id,
      email: mockedAccounts[0].email,
      date: date
    }
  ]

  const mockedDownloadPDF = () => Promise.resolve("mocked_path")
  let emailPdfCalled = false
  const mockedEmailPdf = () => {
    emailPdfCalled = true
    return Promise.resolve("mocked_email")
  }
  const mockedLogSentMail = () => {}

  await main({
    simulate,
    date,
    accounts: mockedAccounts,
    getCookie: mockedGetCookie,
    getSentMails: mockedGetSentMails,
    downloadPDF: mockedDownloadPDF,
    emailPdf: mockedEmailPdf,
    logSentMail: mockedLogSentMail
  })

  assert.strictEqual(emailPdfCalled, false)
})

test("shouldn't email pdf if there is an error downloading it", async () => {
  const date = "2023-10-01"
  const simulate = false
  const mockedAccounts = [
    {
      first_name: "Matt",
      last_name: "R",
      teamgantt_project_id: "4251746",
      project_name: "PTM Mechatronics",
      project_number: "1234",
      email: "mattrw2@gmail.com",
      cc: ["mattrw2@gmail.com"]
    }
  ]

  const mockedGetCookie = () => Promise.resolve("mocked_cookie")
  const mockedGetSentMails = () => []

  const mockedDownloadPDF = () => Promise.reject("error downloading PDF")
  let emailPdfCalled = false
  const mockedEmailPdf = () => {
    emailPdfCalled = true
    return Promise.resolve("mocked_email")
  }
  const mockedLogSentMail = () => {}

  await main({
    simulate,
    date,
    accounts: mockedAccounts,
    getCookie: mockedGetCookie,
    getSentMails: mockedGetSentMails,
    downloadPDF: mockedDownloadPDF,
    emailPdf: mockedEmailPdf,
    logSentMail: mockedLogSentMail
  })

  assert.strictEqual(emailPdfCalled, false)
})
