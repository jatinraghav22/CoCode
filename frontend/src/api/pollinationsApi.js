import axios from "axios"

const pollinationsBaseUrl =
    import.meta.env.VITE_POLLINATIONS_BASE_URL || "https://gen.pollinations.ai"

const headers = {
    "Content-Type": "application/json",
}

if (import.meta.env.VITE_POLLINATIONS_API_KEY) {
    headers.Authorization = `Bearer ${import.meta.env.VITE_POLLINATIONS_API_KEY}`
}

const instance = axios.create({
    baseURL: pollinationsBaseUrl,
    headers,
})

export default instance
