import express from "express"
import { main } from "./main.js"
import bodyParser from "body-parser"

const app = express()
const PORT = process.env.PORT || 3000

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.post("/main", (req, res) => {
  try {
    const { accounts } = req.body

    main(accounts)
    res.send("Emails will send shortly!")
  } catch (error) {
    console.error("Error sending emails:", error.message)
    res.status(500).send("Error sending emails")
  }
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
