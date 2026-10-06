import axios from "axios"
import { API_URL } from "@/config/env"
import { createJudge0Submission, getJudge0Languages, getJudge0Submission } from "./judge0Api"
import pistonInstance from "./pistonApi"

export const DEFAULT_LANGUAGES = [
    {
        id: 54,
        judge0Id: 54,
        language: "cpp",
        name: "C++ (GCC 9.2.0)",
        version: "GCC 9.2.0",
        extension: "cpp",
        aliases: ["cpp", "cc", "cxx", "hpp", "hh", "hxx"],
        pistonName: "cpp",
        pistonVersion: "10.2.0",
    },
    {
        id: 50,
        judge0Id: 50,
        language: "c",
        name: "C (GCC 9.2.0)",
        version: "GCC 9.2.0",
        extension: "c",
        aliases: ["c", "h"],
        pistonName: "c",
        pistonVersion: "10.2.0",
    },
    {
        id: 71,
        judge0Id: 71,
        language: "python",
        name: "Python (3.8.1)",
        version: "3.8.1",
        extension: "py",
        aliases: ["py", "python3"],
        pistonName: "python",
        pistonVersion: "3.10.0",
    },
    {
        id: 63,
        judge0Id: 63,
        language: "javascript",
        name: "JavaScript (Node.js 12.14.0)",
        version: "Node.js 12.14.0",
        extension: "js",
        aliases: ["js", "mjs", "cjs", "jsx"],
        pistonName: "javascript",
        pistonVersion: "18.15.0",
    },
    {
        id: 62,
        judge0Id: 62,
        language: "java",
        name: "Java (OpenJDK 13.0.1)",
        version: "OpenJDK 13.0.1",
        extension: "java",
        aliases: ["java"],
        pistonName: "java",
        pistonVersion: "15.0.2",
    },
    {
        id: 74,
        judge0Id: 74,
        language: "typescript",
        name: "TypeScript (3.7.4)",
        version: "3.7.4",
        extension: "ts",
        aliases: ["ts", "tsx"],
        pistonName: "typescript",
        pistonVersion: "5.0.3",
    },
    {
        id: 73,
        judge0Id: 73,
        language: "rust",
        name: "Rust (1.40.0)",
        version: "1.40.0",
        extension: "rs",
        aliases: ["rs"],
        pistonName: "rust",
        pistonVersion: "1.68.2",
    },
    {
        id: 60,
        judge0Id: 60,
        language: "go",
        name: "Go (1.13.5)",
        version: "1.13.5",
        extension: "go",
        aliases: ["go"],
        pistonName: "go",
        pistonVersion: "1.16.2",
    },
    {
        id: 51,
        judge0Id: 51,
        language: "csharp",
        name: "C# (Mono 6.6.0.161)",
        version: "Mono 6.6.0.161",
        extension: "cs",
        aliases: ["cs"],
        pistonName: "csharp",
        pistonVersion: "6.12.0",
    },
    {
        id: 68,
        judge0Id: 68,
        language: "php",
        name: "PHP (7.4.1)",
        version: "7.4.1",
        extension: "php",
        aliases: ["php"],
        pistonName: "php",
        pistonVersion: "8.2.3",
    },
]

export const LANGUAGE_STARTERS = {
    cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, CoCodee!";
    return 0;
}`,
    c: `#include <stdio.h>

int main() {
    printf("Hello, CoCodee!\\n");
    return 0;
}`,
    python: `print("Hello, CoCodee!")`,
    java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, CoCodee!");
    }
}`,
    javascript: `console.log("Hello, CoCodee!");`,
    typescript: `const greeting: string = "Hello, CoCodee!";
console.log(greeting);`,
    rust: `fn main() {
    println!("Hello, CoCodee!");
}`,
    go: `package main
import "fmt"

func main() {
    fmt.Println("Hello, CoCodee!")
}`,
    csharp: `using System;

class Program {
    static void Main() {
        Console.WriteLine("Hello, CoCodee!");
    }
}`,
    php: `<?php
echo "Hello, CoCodee!";
`,
}

export const fetchSupportedLanguages = async () => {
    // 1. Try Backend
    try {
        const response = await axios.get(`${API_URL}/api/languages`, { timeout: 3000 })
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            return response.data
        }
    } catch {
        // Continue
    }

    // 2. Try Judge0
    try {
        const languages = await getJudge0Languages()
        if (Array.isArray(languages) && languages.length > 0) {
            return languages.map((runtime) => {
                const nameMatch = runtime.name.match(/^(.+?)\s*\((.+)\)$/)
                const rawLang = nameMatch ? nameMatch[1].trim() : runtime.name.trim()
                const version = nameMatch ? nameMatch[2].trim() : ""
                const language = rawLang.toLowerCase().replace(/[^a-z0-9]/g, "")
                const matchedDefault = DEFAULT_LANGUAGES.find((d) => d.language === language || d.judge0Id === runtime.id)
                return {
                    id: runtime.id,
                    judge0Id: runtime.id,
                    language: matchedDefault ? matchedDefault.language : language,
                    name: runtime.name,
                    version,
                    extension: matchedDefault ? matchedDefault.extension : "txt",
                    aliases: matchedDefault ? matchedDefault.aliases : [language],
                    pistonName: matchedDefault?.pistonName || language,
                    pistonVersion: matchedDefault?.pistonVersion || "*",
                }
            })
        }
    } catch {
        // Continue
    }

    return DEFAULT_LANGUAGES
}

const pollJudge0Result = async (token) => {
    const maxAttempts = 20
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const submission = await getJudge0Submission(token)
        const statusId = submission.status?.id
        if (!statusId || statusId > 2) {
            return submission
        }
        await new Promise((resolve) => setTimeout(resolve, 600))
    }
    throw new Error("Timed out while waiting for code execution")
}

export const runCodeExecution = async (sourceCode, stdin = "", language) => {
    if (!sourceCode && sourceCode !== "") {
        throw new Error("Source code is required")
    }

    const langObj = typeof language === "string"
        ? DEFAULT_LANGUAGES.find((l) => l.language === language.toLowerCase() || l.aliases.includes(language.toLowerCase())) || DEFAULT_LANGUAGES[0]
        : language

    // Strategy 1: Backend /api/execute
    try {
        const backendRes = await axios.post(
            `${API_URL}/api/execute`,
            {
                code: sourceCode,
                language: langObj.language,
                language_id: langObj.judge0Id || langObj.id,
                stdin,
            },
            { timeout: 15000 },
        )

        if (backendRes.data && (backendRes.data.output !== undefined || backendRes.data.stdout !== undefined)) {
            const data = backendRes.data
            const isError = Boolean(data.stderr || data.compile_output || (data.status?.description && !data.status.description.toLowerCase().includes("accepted")))
            return {
                output: data.output || data.stdout || data.stderr || "(Program produced no output)",
                isError,
                status: data.status?.description || (isError ? "Error" : "Success"),
                compileOutput: data.compile_output || "",
                stderr: data.stderr || "",
                stdout: data.stdout || "",
            }
        }
    } catch (err) {
        console.warn("Backend execution attempt failed, trying direct Judge0/Piston:", err.message)
    }

    // Strategy 2: Direct Judge0 API
    if (langObj.judge0Id) {
        try {
            let submission
            try {
                submission = await createJudge0Submission(
                    {
                        language_id: langObj.judge0Id,
                        source_code: sourceCode,
                        stdin,
                    },
                    true,
                )
            } catch (judgeWaitErr) {
                const errMsg = judgeWaitErr?.response?.data?.error?.toLowerCase() || ""
                if (errMsg.includes("wait not allowed")) {
                    const queued = await createJudge0Submission(
                        {
                            language_id: langObj.judge0Id,
                            source_code: sourceCode,
                            stdin,
                        },
                        false,
                    )
                    if (queued.token) {
                        submission = await pollJudge0Result(queued.token)
                    } else {
                        throw judgeWaitErr
                    }
                } else {
                    throw judgeWaitErr
                }
            }

            if (submission) {
                const isError = Boolean(submission.stderr || submission.compile_output || (submission.status?.id && submission.status.id > 3))
                const output =
                    submission.stderr ||
                    submission.compile_output ||
                    submission.stdout ||
                    submission.message ||
                    submission.status?.description ||
                    "(Program produced no output)"

                return {
                    output,
                    isError,
                    status: submission.status?.description || (isError ? "Error" : "Success"),
                    compileOutput: submission.compile_output || "",
                    stderr: submission.stderr || "",
                    stdout: submission.stdout || "",
                }
            }
        } catch (judge0DirectErr) {
            console.warn("Direct Judge0 failed, falling back to Piston:", judge0DirectErr.message)
        }
    }

    // Strategy 3: Piston API
    try {
        const pistonRes = await pistonInstance.post("/execute", {
            language: langObj.pistonName || langObj.language,
            version: langObj.pistonVersion || "*",
            files: [{ content: sourceCode }],
            stdin,
        })

        const run = pistonRes.data.run || {}
        const compile = pistonRes.data.compile || {}
        const isError = (run.code !== 0 && run.code !== undefined) || Boolean(compile.stderr || run.stderr)
        const output =
            compile.stderr ||
            compile.output ||
            run.stderr ||
            run.stdout ||
            run.output ||
            "(Program produced no output)"

        return {
            output,
            isError,
            status: run.code === 0 ? "Success" : "Runtime Error",
            compileOutput: compile.output || compile.stderr || "",
            stderr: run.stderr || compile.stderr || "",
            stdout: run.stdout || "",
        }
    } catch (pistonDirectErr) {
        console.error("All execution backends failed:", pistonDirectErr)
        throw new Error("Unable to execute code. Please check your internet connection or server availability.")
    }
}
