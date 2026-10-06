import axios from "axios"
import { API_URL } from "@/config/env"

const authClient = axios.create({
    baseURL: `${API_URL}/api/auth`,
    headers: {
        "Content-Type": "application/json",
    },
})

export const registerApi = async (data) => {
    const response = await authClient.post("/register", data)
    return response.data
}

export const loginApi = async (data) => {
    const response = await authClient.post("/login", {
        ...data,
        identifier: data.email,
    })
    return response.data
}

export const logoutApi = async () => {
    const response = await authClient.post("/logout")
    return response.data
}

export const getMeApi = async (token) => {
    const response = await authClient.get("/me", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })
    return response.data
}

export const updateProfileApi = async (
    data,
    token,
) => {
    const response = await authClient.put("/profile", data, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })
    return response.data
}
