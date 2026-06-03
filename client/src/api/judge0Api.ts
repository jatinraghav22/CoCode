import axios, { AxiosInstance } from "axios"

interface Judge0Language {
    id: number
    name: string
}

interface Judge0SubmissionRequest {
    source_code: string
    language_id: number
    stdin?: string
}

interface Judge0SubmissionResponse {
    token?: string
    stdout?: string | null
    stderr?: string | null
    compile_output?: string | null
    message?: string | null
    status?: {
        id: number
        description: string
    }
}

const judge0BaseUrl = import.meta.env.VITE_JUDGE0_BASE_URL || "https://ce.judge0.com"

const headers: Record<string, string> = {
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

const judge0Api: AxiosInstance = axios.create({
    baseURL: judge0BaseUrl,
    headers,
})

const getJudge0Languages = async (): Promise<Judge0Language[]> => {
    const response = await judge0Api.get<Judge0Language[]>("/languages")
    return response.data
}

const createJudge0Submission = async (
    payload: Judge0SubmissionRequest,
    wait = true,
): Promise<Judge0SubmissionResponse> => {
    const response = await judge0Api.post<Judge0SubmissionResponse>(
        `/submissions?base64_encoded=false&wait=${wait}`,
        payload,
    )
    return response.data
}

const getJudge0Submission = async (
    token: string,
): Promise<Judge0SubmissionResponse> => {
    const response = await judge0Api.get<Judge0SubmissionResponse>(
        `/submissions/${token}?base64_encoded=false&fields=stdout,stderr,compile_output,message,status,token`,
    )
    return response.data
}

export type { Judge0Language, Judge0SubmissionResponse }
export { createJudge0Submission, getJudge0Languages, getJudge0Submission }
export default judge0Api