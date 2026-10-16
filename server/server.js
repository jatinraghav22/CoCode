
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

const JUDGE0_BASE_URL = (
    process.env.JUDGE0_BASE_URL || "https://ce.judge0.com"
).replace(/\/+$/, "");

const JUDGE0_AUTH_TOKEN = process.env.JUDGE0_AUTH_TOKEN;

// Language IDs verified against the current official Judge0 CE language list.
// Recheck https://ce.judge0.com/languages if the service changes versions.
const SUPPORTED_LANGUAGES = {
    python: 100,     // Python 3.12.5
    javascript: 102, // JavaScript (Node.js 22.08.0)
    cpp: 105,        // C++ (GCC 14.1.0)
};

const runRateLimits = new Map();

app.use(cors());
app.use(express.json({ limit: "64kb" }));

app.get("/", (req, res) => {
    res.json({
        message: "Welcome to the CoCode API!",
        status: "Server is running",
    });
});

app.get("/api/health", (req, res) => {
    res.json({ status: "healthy" });
});

function getRetryAfter(ip) {
    const now = Date.now();
    let entry = runRateLimits.get(ip);

    if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + 60_000 };
        runRateLimits.set(ip, entry);
    }

    if (entry.count >= 10) {
        return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    }

    entry.count += 1;

    // Keep the in-memory limiter from growing indefinitely.
    if (runRateLimits.size > 2000) {
        for (const [key, value] of runRateLimits) {
            if (value.resetAt <= now) runRateLimits.delete(key);
        }
    }

    return 0;
}

const wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

app.post("/api/compiler/run", async (req, res) => {
    const { sourceCode, language, stdin = "" } = req.body || {};

    if (typeof sourceCode !== "string" || !sourceCode.trim()) {
        return res.status(400).json({
            error: "Please enter some code before running it.",
        });
    }

    if (sourceCode.length > 30_000) {
        return res.status(413).json({
            error: "Code is too large. The maximum source size is 30,000 characters.",
        });
    }

    if (typeof stdin !== "string" || stdin.length > 10_000) {
        return res.status(400).json({
            error: "Input must be text and no longer than 10,000 characters.",
        });
    }

    const languageId = SUPPORTED_LANGUAGES[language];

    if (!languageId) {
        return res.status(400).json({
            error: "Unsupported language. Choose Python, JavaScript, or C++.",
        });
    }

    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    const retryAfter = getRetryAfter(clientIp);

    if (retryAfter > 0) {
        res.set("Retry-After", String(retryAfter));
        return res.status(429).json({
            error: "Too many execution requests. Please wait before running more code.",
        });
    }

    const headers = { "Content-Type": "application/json" };

    if (JUDGE0_AUTH_TOKEN) {
        headers["X-Auth-Token"] = JUDGE0_AUTH_TOKEN;
    }

    try {
        const submissionResponse = await fetch(
            `${JUDGE0_BASE_URL}/submissions?base64_encoded=false&wait=false`,
            {
                method: "POST",
                headers,
                signal: AbortSignal.timeout(8000),
                body: JSON.stringify({
                    source_code: sourceCode,
                    language_id: languageId,
                    stdin,
                    cpu_time_limit: 2,
                    cpu_extra_time: 1,
                    wall_time_limit: 5,
                    memory_limit: 128000,
                    enable_network: false,
                }),
            }
        );

        const submission = await submissionResponse.json().catch(() => ({}));

        if (!submissionResponse.ok || !submission.token) {
            const message =
                submission.error ||
                submission.message ||
                `Execution service returned HTTP ${submissionResponse.status}.`;

            return res.status(
                submissionResponse.status === 429 ? 503 : 502
            ).json({ error: message });
        }

        let result = null;

        // Poll for up to about 18 seconds; the remote service may be busy.
        for (let attempt = 0; attempt < 24; attempt += 1) {
            await wait(750);

            const resultResponse = await fetch(
                `${JUDGE0_BASE_URL}/submissions/${encodeURIComponent(submission.token)}` +
                "?base64_encoded=false&fields=stdout,stderr,compile_output,message,status,time,memory",
                {
                    headers,
                    signal: AbortSignal.timeout(8000),
                }
            );

            const resultData = await resultResponse.json().catch(() => ({}));

            if (!resultResponse.ok) {
                return res.status(502).json({
                    error: "Could not retrieve the execution result from the compiler service.",
                });
            }

            const statusId = resultData.status?.id;

            if (statusId && ![1, 2].includes(statusId)) {
                result = resultData;
                break;
            }
        }

        if (!result) {
            return res.status(504).json({
                error: "Execution took too long. Please try again.",
            });
        }

        return res.json({
            status: result.status?.description || "Finished",
            stdout: result.stdout || "",
            stderr: result.stderr || "",
            compileOutput: result.compile_output || "",
            message: result.message || "",
            time: result.time ?? null,
            memory: result.memory ?? null,
        });
    } catch (error) {
        console.error("Compiler service request failed:", error.message);

        if (
            error.name === "TimeoutError" ||
            error.name === "AbortError"
        ) {
            return res.status(504).json({
                error: "The compiler service timed out. Please try again.",
            });
        }

        return res.status(502).json({
            error:
                "Cannot reach the execution service. Check the network and Judge0 configuration.",
        });
    }
});

app.listen(PORT, () => {
    console.log(`CoCode server running at http://localhost:${PORT}`);
});
