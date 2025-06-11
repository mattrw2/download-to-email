const pdfOptions = {
  page_size: "A4",
  color: "default",
  orientation: "l", // landscape
  include_blank_dates: "1",
  show_estimated_hours_column: "0", // this also hides the actual hours column
  show_percent_column: "1",
  display_resources: "0",
  display_dependencies: "0",
  display_name_in_bars: "0",
  show_name_next_to_bar: "1",
  date_format: "d/m/Y", // DD/MM/YY
  pdf_font_face: "dejavusans", // system default
  pdf_font_size: "8",
  task_list: "large", // task details width
  show_project_name_on_bar: "1"
}

const emailFileName = "report"
const logFileName = "mailLog"
const graphAPIAppId = "c13fffc1-3327-466e-8b2d-292a89357d5a"
const driveId = "b!OrjuRu2aRkOjO4RIhcKRldY6_9e_ymtIjUPrd84MNxSGshmUJ1o6RYubaS5azclQ"
const driveItemId = "016AEJ76TNQW6IECLS5VGZJKV52TPTVGLO"

const expectedAccountSchema = {
  "project number": { required: true, type: "string" },
  "project name": { required: true, type: "string" },
  "teamgantt project id": { required: true, type: "number" },
  "customer first name": { required: true, type: "string" },
  "customer last name": { required: true, type: "string" },
  "customer email": { required: true, type: "email" },
  "customer email cc": { required: false, type: "emailList" }
}

export { pdfOptions, emailFileName, logFileName, graphAPIAppId, driveId, driveItemId, expectedAccountSchema }
