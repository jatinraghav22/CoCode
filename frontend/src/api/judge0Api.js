import axios from "axios"

const judge0BaseUrl = import.meta.env.VITE_JUDGE0_BASE_URL || "https://ce.judge0.com"

const headers = {
    "Content-Type": "application/json",
}

if (import.meta.env.VITE_JUDGE0_API_KEY) {
    headers["X-RapidAPI-Key"] = import.meta.env.VITE_JUDGE0_API_KEY
}

if (import.meta.env.VITE_JUDGE0_API_HOST) {
    headers["X-RapidAPI-Host"] = import.meta.env.VITE_JUDGE0_API_HOST
}

if (import.meta.env.VITE_JUDGE0_AUTH_TOKEN) {
    headers["X-Auth-Token"] = import.meta.env.VITE_JUDGE0_AUTH_TOKEN
}

if (import.meta.env.VITE_JUDGE0_AUTH_USER) {
    headers["X-Auth-User"] = import.meta.env.VITE_JUDGE0_AUTH_USER
}

const judge0Api = axios.create({
    baseURL: judge0BaseUrl,
    headers,
})

const getJudge0Languages = async () => {
    const response = await judge0Api.get("/languages")
    return response.data
}

const createJudge0Submission = async (
    payload,
    wait = true,
) => {
    const response = await judge0Api.post(
        `/submissions?base64_encoded=false&wait=${wait}`,
        payload,
    )
    return response.data
}

const getJudge0Submission = async (token) => {
    const response = await judge0Api.get(
        `/submissions/${token}?base64_encoded=false&fields=stdout,stderr,compile_output,message,status,token`,
    )
    return response.data
}

export { createJudge0Submission, getJudge0Languages, getJudge0Submission }
export default judge0Api
