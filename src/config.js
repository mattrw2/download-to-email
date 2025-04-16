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
  date_format: "j%2Fn%2Fy", // DD/MM/YY
  pdf_font_face: "dejavusans", // system default
  pdf_font_size: "8",
  task_list: "large", // task details width
  show_project_name_on_bar: "1"
}

const emailFileName = "report"
const logFileName = "mailLog"


export { pdfOptions, emailFileName, logFileName }
