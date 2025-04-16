import axios from "axios"

const apiUrl = "https://api.teamgantt.com/v1"
const authUrl = "https://auth.teamgantt.com/oauth2/token"

const axiosInstance = axios.create()

const getToken = async () => {
  const authHeader = Buffer.from(
    `${process.env.TEAMGANTT_CLIENT_ID}:${process.env.TEAMGANTT_CLIENT_SECRET}`
  ).toString("base64")

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization: `Basic ${authHeader}`
  }

  const data = `grant_type=password&username=${process.env.TEAMGANTT_USER}&password=${process.env.TEAMGANTT_PASSWORD}`
  const response = await axios.post(authUrl, data, { headers })
  const { access_token } = response.data
  return access_token
}

const api = async (endpoint, { method = "GET", payload = null } = {}) => {
  const accessToken = await getToken()
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  }

  const options = {
    method,
    url: `${apiUrl}/${endpoint}`,
    headers
  }

  if (method !== "GET" && payload !== null) {
    options.data = payload
  }

  const response = await axiosInstance(options)

  if (response.status === 204) {
    return
  }

  return response.data
}

const collapseRootGroups = async (projects) => {
  try {
    const groups = await api(`groups?project_ids=${projects}`)

    const data = groups
      .filter((g) => g.parent_group_id == null)
      .map((g) => {
        return {
          id: g.id,
          is_collapsed: true
        }
      })
    await api("groups", { method: "PATCH", payload: { data } })
  } catch (error) {
    console.error("Error collapsing root groups:", error.message)
    throw error
  }
}

export { collapseRootGroups }
