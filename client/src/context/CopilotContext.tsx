import { ICopilotContext } from "@/types/copilot"
import { AxiosError } from "axios"
import { createContext, ReactNode, useContext, useState } from "react"
import toast from "react-hot-toast"
import axiosInstance from "../api/pollinationsApi"

interface ChatCompletionChoice {
    message?: {
        content?: string | null
    }
}

interface PollinationsChatResponse {
    choices?: ChatCompletionChoice[]
}

const CopilotContext = createContext<ICopilotContext | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useCopilot = () => {
    const context = useContext(CopilotContext)
    if (context === null) {
        throw new Error(
            "useCopilot must be used within a CopilotContextProvider",
        )
    }
    return context
}

const CopilotContextProvider = ({ children }: { children: ReactNode }) => {
    const [input, setInput] = useState<string>("")
    const [output, setOutput] = useState<string>("")
    const [isRunning, setIsRunning] = useState<boolean>(false)

    const generateCode = async () => {
        try {
            if (input.length === 0) {
                toast.error("Please write a prompt")
                return
            }

            if (!import.meta.env.VITE_POLLINATIONS_API_KEY) {
                toast.error("Missing Pollinations API key in env")
                return
            }

            toast.loading("Generating code...")
            setIsRunning(true)

            const response = await axiosInstance.post<PollinationsChatResponse>(
                "/v1/chat/completions",
                {
                    model: import.meta.env.VITE_POLLINATIONS_MODEL || "openai",
                    messages: [
                        {
                            role: "system",
                            content:
                                "You are a code generator copilot for project named CoCode. Generate code based on the given prompt without any explanation. Return only the code, formatted in Markdown using the appropriate language syntax (e.g., js for JavaScript, py for Python). Do not include any additional text or explanations. If you don't know the answer, respond with 'I don't know'.",
                        },
                        {
                            role: "user",
                            content: input,
                        },
                    ],
                    stream: false,
                },
            )

            const code = response.data?.choices?.[0]?.message?.content?.trim()

            if (code) {
                setOutput(code)
                toast.success("Code generated successfully")
            } else {
                toast.error("No content returned by Pollinations")
            }

            setIsRunning(false)
            toast.dismiss()
        } catch (error) {
            const axiosError = error as AxiosError<{
                error?: { message?: string }
            }>
            console.error(axiosError?.response?.data || error)
            setIsRunning(false)
            toast.dismiss()
            toast.error(
                axiosError.response?.data?.error?.message ||
                    "Failed to generate the code",
            )
        }
    }

    return (
        <CopilotContext.Provider
            value={{
                setInput,
                output,
                isRunning,
                generateCode,
            }}
        >
            {children}
        </CopilotContext.Provider>
    )
}

export { CopilotContextProvider }
export default CopilotContext
