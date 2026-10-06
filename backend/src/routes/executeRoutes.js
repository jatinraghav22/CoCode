import express from "express"

const router = express.Router()

const SUPPORTED_LANGUAGES = [
    {
        id: 54,
        language: "cpp",
        name: "C++ (GCC 9.2.0)",
        version: "GCC 9.2.0",
        aliases: ["cpp", "cc", "cxx", "hpp", "hh", "hxx"],
        judge0Id: 54,
        pistonName: "cpp",
        pistonVersion: "10.2.0",
    },
    {
        id: 50,
        language: "c",
        name: "C (GCC 9.2.0)",
        version: "GCC 9.2.0",
        aliases: ["c", "h"],
        judge0Id: 50,
        pistonName: "c",
        pistonVersion: "10.2.0",
    },
    {
        id: 71,
        language: "python",
        name: "Python (3.8.1)",
        version: "3.8.1",
        aliases: ["py", "python3"],
        judge0Id: 71,
        pistonName: "python",
        pistonVersion: "3.10.0",
    },
    {
        id: 63,
        language: "javascript",
        name: "JavaScript (Node.js 12.14.0)",
        version: "Node.js 12.14.0",
        aliases: ["js", "mjs", "cjs", "jsx"],
        judge0Id: 63,
        pistonName: "javascript",
        pistonVersion: "18.15.0",
    },
    {
        id: 62,
        language: "java",
        name: "Java (OpenJDK 13.0.1)",
        version: "OpenJDK 13.0.1",
        aliases: ["java"],
        judge0Id: 62,
        pistonName: "java",
        pistonVersion: "15.0.2",
    },
    {
        id: 74,
        language: "typescript",
        name: "TypeScript (3.7.4)",
        version: "3.7.4",
        aliases: ["ts", "tsx"],
        judge0Id: 74,
        pistonName: "typescript",
        pistonVersion: "5.0.3",
    },
    {
        id: 73,
        language: "rust",
        name: "Rust (1.40.0)",
        version: "1.40.0",
        aliases: ["rs"],
        judge0Id: 73,
        pistonName: "rust",
        pistonVersion: "1.68.2",
    },
    {
        id: 60,
        language: "go",
        name: "Go (1.13.5)",
        version: "1.13.5",
        aliases: ["go"],
        judge0Id: 60,
        pistonName: "go",
        pistonVersion: "1.16.2",
    },
    {
        id: 51,
        language: "csharp",
        name: "C# (Mono 6.6.0.161)",
        version: "Mono 6.6.0.161",
        aliases: ["cs"],
        judge0Id: 51,
        pistonName: "csharp",
        pistonVersion: "6.12.0",
    },
    {
        id: 68,
        language: "php",
        name: "PHP (7.4.1)",
        version: "7.4.1",
        aliases: ["php"],
        judge0Id: 68,
        pistonName: "php",
        pistonVersion: "8.2.3",
    },
]

/**
 * GET /api/languages
 */
router.get("/languages", (_req, res) => {
    return res.json(SUPPORTED_LANGUAGES)
})

/**
 * POST /api/execute
 * Body: { code, source_code, language, stdin, language_id }
 */
router.post("/execute", async (req, res) => {
    try {
        const { code, source_code, language, stdin = "", language_id } = req.body
        const rawCode = code !== undefined ? code : (source_code || "")

        if (rawCode === undefined || rawCode === null) {
            return res.status(400).json({ error: "No code provided for execution" })
        }

        // Find language info
        let langInfo = null
        if (language_id) {
            langInfo = SUPPORTED_LANGUAGES.find((l) => l.judge0Id === Number(language_id) || l.id === Number(language_id))
        }
        if (!langInfo && language) {
            const normalized = typeof language === "string" ? language.toLowerCase().trim() : (language.language || "")
            langInfo = SUPPORTED_LANGUAGES.find((l) => l.language === normalized || l.aliases.includes(normalized))
        }

        if (!langInfo) {
            langInfo = SUPPORTED_LANGUAGES[0] // default to C++
        }

        // Try Judge0 first if available
        try {
            const judge0Url = process.env.JUDGE0_URL || "https://ce.judge0.com"
            const headers = { "Content-Type": "application/json" }
            if (process.env.JUDGE0_API_KEY) {
                headers["X-RapidAPI-Key"] = process.env.JUDGE0_API_KEY
            }
            if (process.env.JUDGE0_API_HOST) {
                headers["X-RapidAPI-Host"] = process.env.JUDGE0_API_HOST
            }

            const response = await fetch(`${judge0Url}/submissions?base64_encoded=false&wait=true`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    source_code: rawCode,
                    language_id: langInfo.judge0Id,
                    stdin: stdin || "",
                }),
            })

            if (response.ok) {
                const data = await response.json()
                const output =
                    data.stderr ||
                    data.compile_output ||
                    data.stdout ||
                    data.message ||
                    data.status?.description ||
                    ""

                return res.json({
                    output,
                    stdout: data.stdout || "",
                    stderr: data.stderr || data.compile_output || "",
                    compile_output: data.compile_output || "",
                    status: data.status,
                    time: data.time,
                    memory: data.memory,
                })
            }
        } catch (judge0Err) {
            console.warn("Judge0 submission failed, falling back to Piston:", judge0Err.message)
        }

        // Fallback to Piston
        try {
            const pistonRes = await fetch("https://emkc.org/api/v2/piston/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    language: langInfo.pistonName || langInfo.language,
                    version: langInfo.pistonVersion || "*",
                    files: [{ content: rawCode }],
                    stdin: stdin || "",
                }),
            })

            if (pistonRes.ok) {
                const pistonData = await pistonRes.json()
                const run = pistonData.run || {}
                const compile = pistonData.compile || {}
                const output =
                    compile.stderr ||
                    compile.output ||
                    run.stderr ||
                    run.stdout ||
                    run.output ||
                    ""

                return res.json({
                    output,
                    stdout: run.stdout || "",
                    stderr: run.stderr || compile.stderr || "",
                    compile_output: compile.output || compile.stderr || "",
                    status: { description: run.code === 0 ? "Accepted" : "Runtime Error" },
                })
            }
        } catch (pistonErr) {
            console.error("Piston submission failed:", pistonErr.message)
        }

        return res.status(502).json({
            error: "Unable to execute code at this time. Please check your network connection.",
        })
    } catch (err) {
        console.error("Execution error:", err)
        return res.status(500).json({ error: "Internal execution error" })
    }
})

export default router
