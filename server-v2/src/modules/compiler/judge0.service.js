"use strict";

class UpstreamError extends Error {
  constructor(message = "Cannot reach the code execution service.", statusCode = 502) {
    super(message);
    this.name = "UpstreamError";
    this.statusCode = statusCode;
  }
}

class TimeoutError extends Error {
  constructor(message = "The compiler service timed out. Please try again.", statusCode = 504) {
    super(message);
    this.name = "TimeoutError";
    this.statusCode = statusCode;
  }
}

class ServiceUnavailableError extends Error {
  constructor(message = "The compiler service is busy. Please try again shortly.", statusCode = 503) {
    super(message);
    this.name = "ServiceUnavailableError";
    this.statusCode = statusCode;
  }
}

/**
 * Judge0 API Client Service.
 * Handles submission, polling, base64 encoding/decoding, and normalization.
 */
class Judge0Service {
  /**
   * @param {Object} [options]
   * @param {string} [options.baseUrl]
   * @param {string} [options.apiKey]
   * @param {number} [options.timeoutMs=10000]
   * @param {number} [options.pollIntervalMs=750]
   * @param {number} [options.maxPollAttempts=15]
   * @param {boolean} [options.useBase64=true]
   * @param {Function} [options.fetchFn]
   * @param {Function} [options.sleepFn]
   */
  constructor(options = {}) {
    const rawBaseUrl = options.baseUrl || process.env.JUDGE0_BASE_URL || "https://ce.judge0.com";
    this.baseUrl = rawBaseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey || process.env.JUDGE0_API_KEY || process.env.JUDGE0_AUTH_TOKEN || null;
    this.timeoutMs = Number(options.timeoutMs || process.env.JUDGE0_TIMEOUT_MS || 10000);
    this.pollIntervalMs = Number(options.pollIntervalMs || process.env.JUDGE0_POLL_INTERVAL_MS || 750);
    this.maxPollAttempts = Number(options.maxPollAttempts || process.env.JUDGE0_MAX_POLL_ATTEMPTS || 15);
    this.useBase64 = options.useBase64 !== undefined ? Boolean(options.useBase64) : true;
    this.fetchFn = typeof options.fetchFn === "function" ? options.fetchFn : globalThis.fetch;
    this.sleepFn =
      typeof options.sleepFn === "function"
        ? options.sleepFn
        : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Encodes a string to base64.
   * @param {string} str
   * @returns {string}
   */
  encodeBase64(str) {
    return Buffer.from(String(str || ""), "utf8").toString("base64");
  }

  /**
   * Decodes a base64 string. Returns null if input is falsy.
   * @param {string|null} str
   * @returns {string|null}
   */
  decodeBase64(str) {
    if (!str || typeof str !== "string") {
      return null;
    }
    try {
      return Buffer.from(str, "base64").toString("utf8");
    } catch {
      return str;
    }
  }

  /**
   * Formats HTTP request headers without exposing credentials.
   * @returns {Record<string, string>}
   */
  getHeaders() {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (this.apiKey) {
      headers["X-Auth-Token"] = this.apiKey;

      if (this.baseUrl.includes("rapidapi.com")) {
        headers["X-RapidAPI-Key"] = this.apiKey;
        try {
          headers["X-RapidAPI-Host"] = new URL(this.baseUrl).host;
        } catch {
          // ignore invalid URL host extraction
        }
      }
    }

    return headers;
  }

  /**
   * Normalizes a raw Judge0 submission execution result.
   *
   * @param {Object} raw
   * @returns {Object}
   */
  normalizeResult(raw) {
    if (!raw || typeof raw !== "object") {
      return {
        status: { id: 0, description: "Unknown" },
        stdout: null,
        stderr: null,
        compileOutput: null,
        message: null,
        time: null,
        memory: null,
      };
    }

    const decode = (val) => {
      if (val === undefined || val === null) return null;
      if (this.useBase64) {
        return this.decodeBase64(val);
      }
      return typeof val === "string" ? val : String(val);
    };

    return {
      status: {
        id: raw.status?.id || 0,
        description: raw.status?.description || "Unknown",
      },
      stdout: decode(raw.stdout),
      stderr: decode(raw.stderr),
      compileOutput: decode(raw.compile_output),
      message: decode(raw.message),
      time: raw.time != null ? String(raw.time) : null,
      memory: raw.memory != null ? Number(raw.memory) : null,
    };
  }

  /**
   * Submits code to Judge0 and retrieves the execution result.
   *
   * @param {Object} params
   * @param {number} params.languageId - Judge0 language ID.
   * @param {string} params.sourceCode - Program source code.
   * @param {string} [params.stdin=""] - Custom standard input.
   * @returns {Promise<Object>} Normalized execution response.
   */
  async execute({ languageId, sourceCode, stdin = "" }) {
    if (!languageId || typeof languageId !== "number") {
      throw new Error("languageId must be a valid number.");
    }
    if (typeof sourceCode !== "string") {
      throw new Error("sourceCode must be a string.");
    }

    const headers = this.getHeaders();
    const payload = {
      language_id: languageId,
      source_code: this.useBase64 ? this.encodeBase64(sourceCode) : sourceCode,
      stdin: this.useBase64 ? this.encodeBase64(stdin || "") : stdin || "",
      cpu_time_limit: 2,
      cpu_extra_time: 1,
      wall_time_limit: 5,
      memory_limit: 128000,
      enable_network: false,
    };

    const submissionUrl = `${this.baseUrl}/submissions?base64_encoded=${this.useBase64}&wait=false`;

    let submissionResponse;
    try {
      submissionResponse = await this.fetchFn(submissionUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        throw new TimeoutError("Judge0 submission request timed out.");
      }
      throw new UpstreamError(`Cannot reach execution service: ${err.message}`);
    }

    if (!submissionResponse.ok) {
      if (submissionResponse.status === 429) {
        throw new ServiceUnavailableError("Execution service rate limit exceeded.");
      }
      throw new UpstreamError(
        `Execution service returned HTTP ${submissionResponse.status}.`,
        submissionResponse.status >= 500 ? 502 : 502
      );
    }

    let submissionData;
    try {
      submissionData = await submissionResponse.json();
    } catch {
      throw new UpstreamError("Execution service returned invalid JSON response.");
    }

    // Check if response is already finished (synchronous response)
    if (submissionData && submissionData.status && submissionData.status.id >= 3) {
      return this.normalizeResult(submissionData);
    }

    const token = submissionData?.token;
    if (!token) {
      throw new UpstreamError("Execution service did not return a submission token.");
    }

    // Poll for asynchronous result
    return this.pollResult(token);
  }

  /**
   * Polls Judge0 for submission results until complete or timed out.
   *
   * @param {string} token
   * @returns {Promise<Object>} Normalized execution response.
   */
  async pollResult(token) {
    const headers = this.getHeaders();
    const resultUrl = `${this.baseUrl}/submissions/${encodeURIComponent(
      token
    )}?base64_encoded=${this.useBase64}&fields=stdout,stderr,compile_output,message,status,time,memory`;

    for (let attempt = 1; attempt <= this.maxPollAttempts; attempt += 1) {
      await this.sleepFn(this.pollIntervalMs);

      let response;
      try {
        response = await this.fetchFn(resultUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (err) {
        if (err.name === "TimeoutError" || err.name === "AbortError") {
          throw new TimeoutError("Judge0 status check timed out.");
        }
        throw new UpstreamError(`Cannot reach execution service during poll: ${err.message}`);
      }

      if (!response.ok) {
        if (response.status === 429) {
          throw new ServiceUnavailableError("Execution service busy during status polling.");
        }
        throw new UpstreamError(`Execution service poll returned HTTP ${response.status}.`);
      }

      let data;
      try {
        data = await response.json();
      } catch {
        throw new UpstreamError("Execution service poll returned invalid JSON.");
      }

      const statusId = data?.status?.id;

      // Status IDs:
      // 1: In Queue
      // 2: Processing
      // >= 3: Finished (3: Accepted, 4: Wrong Answer, 5: TLE, 6: Compilation Error, 7-12: Runtime Errors, etc.)
      if (statusId && statusId >= 3) {
        return this.normalizeResult(data);
      }
    }

    throw new TimeoutError("Execution took too long to complete. Please try again.");
  }
}

module.exports = {
  Judge0Service,
  UpstreamError,
  TimeoutError,
  ServiceUnavailableError,
};
