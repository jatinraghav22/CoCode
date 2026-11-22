"use strict";

/** Maximum response body size (2 MB). Applied as a real byte limit while
 *  reading the response stream, not just from Content-Length headers. */
const MAX_RESPONSE_BODY_BYTES = 2 * 1024 * 1024;

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
   * @param {number} [options.maxResponseBodyBytes=2097152]
   */
  constructor(options = {}) {
    const rawBaseUrl = options.baseUrl || process.env.JUDGE0_BASE_URL || "https://ce.judge0.com";
    this.baseUrl = rawBaseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey || process.env.JUDGE0_API_KEY || process.env.JUDGE0_AUTH_TOKEN || null;

    const rawTimeout = Number(options.timeoutMs ?? process.env.JUDGE0_TIMEOUT_MS ?? 10000);
    this.timeoutMs = Number.isFinite(rawTimeout) && rawTimeout >= 1000 && rawTimeout <= 60000 ? rawTimeout : 10000;

    const rawPollInterval = Number(options.pollIntervalMs ?? process.env.JUDGE0_POLL_INTERVAL_MS ?? 750);
    this.pollIntervalMs = Number.isFinite(rawPollInterval) && rawPollInterval >= 100 && rawPollInterval <= 5000 ? rawPollInterval : 750;

    const rawMaxPoll = Number(options.maxPollAttempts ?? process.env.JUDGE0_MAX_POLL_ATTEMPTS ?? 15);
    this.maxPollAttempts = Number.isFinite(rawMaxPoll) && rawMaxPoll >= 1 && rawMaxPoll <= 60 ? rawMaxPoll : 15;

    const rawTotalTimeout = Number(options.totalTimeoutMs ?? process.env.JUDGE0_TOTAL_TIMEOUT_MS ?? 15000);
    this.totalTimeoutMs = Number.isFinite(rawTotalTimeout) && rawTotalTimeout >= 3000 && rawTotalTimeout <= 60000 ? rawTotalTimeout : 15000;

    const rawMaxBody = Number(options.maxResponseBodyBytes ?? MAX_RESPONSE_BODY_BYTES);
    this.maxResponseBodyBytes = Number.isFinite(rawMaxBody) && rawMaxBody >= 1 && rawMaxBody <= 10 * 1024 * 1024 ? rawMaxBody : MAX_RESPONSE_BODY_BYTES;

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
   * Reads and returns the response body as a parsed JSON object, enforcing
   * a real byte limit while reading. This protects against oversized
   * responses regardless of whether Content-Length is present, absent,
   * inaccurate, or the response uses chunked transfer encoding.
   *
   * @param {Response} response  - Fetch Response object (or mock with .body / .text / .json)
   * @param {string} context     - Human-readable label for error messages (e.g. "submission", "poll")
   * @returns {Promise<Object>}  - Parsed JSON body
   * @throws {UpstreamError}     - On oversized body, malformed JSON, or stream error
   */
  async _readBoundedJson(response, context = "response") {
    const limit = this.maxResponseBodyBytes;
    const displayLimit = limit >= 1024 * 1024 ? `${Math.round(limit / 1024 / 1024)} MB` : `${Math.round(limit / 1024)} KB`;

    // 1. Early rejection when Content-Length is known and exceeds the limit
    const clHeader = response.headers?.get?.("content-length");
    if (clHeader) {
      const cl = Number(clHeader);
      if (Number.isFinite(cl) && cl > limit) {
        if (response.body && typeof response.body.getReader === "function") {
          try {
            const reader = response.body.getReader();
            await reader.cancel();
          } catch {
            // Ignore cancellation errors safely
          }
        }
        throw new UpstreamError(
          `Execution service ${context} exceeds maximum allowed size (${displayLimit}).`
        );
      }
    }

    // 2. Reject responses that have no readable streaming body.
    // Calling .text() or .json() directly on an unbuffered response buffers an unbounded
    // body into memory before verifying its size. We reject responses without a streaming body.
    if (!response.body || typeof response.body.getReader !== "function") {
      throw new UpstreamError(
        `Execution service ${context} has no readable streaming body.`
      );
    }

    // 3. Stream-based bounded read: chunk-by-chunk enforcement
    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkBytes = value ? (value.byteLength || value.length || 0) : 0;
        totalBytes += chunkBytes;

        if (totalBytes > limit) {
          try {
            await reader.cancel();
          } catch {
            // Safe cleanup
          }
          throw new UpstreamError(
            `Execution service ${context} exceeds maximum allowed size (${displayLimit}).`
          );
        }

        chunks.push(Buffer.isBuffer(value) ? value : Buffer.from(value));
      }
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      throw new UpstreamError(`Execution service ${context} stream error: ${err.message}`);
    }

    const combined = Buffer.concat(chunks);
    try {
      return JSON.parse(combined.toString("utf8"));
    } catch {
      throw new UpstreamError(`Execution service returned invalid JSON ${context}.`);
    }
  }

  /**
   * Normalizes a raw Judge0 submission execution result.
   * Enforces output size boundaries to protect backend memory and frontend rendering.
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

    const MAX_OUTPUT_LENGTH = 100 * 1024; // 100 KB max per field

    const truncate = (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === "string" && val.length > MAX_OUTPUT_LENGTH) {
        return val.slice(0, MAX_OUTPUT_LENGTH) + "\n... [output truncated: exceeded maximum display limit]";
      }
      return val;
    };

    const decode = (val) => {
      if (val === undefined || val === null) return null;
      let decodedStr;
      if (this.useBase64) {
        decodedStr = this.decodeBase64(val);
      } else {
        decodedStr = typeof val === "string" ? val : String(val);
      }
      return truncate(decodedStr);
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

    const overallDeadline = Date.now() + this.totalTimeoutMs;
    const subRemaining = overallDeadline - Date.now();
    if (subRemaining <= 0) {
      throw new TimeoutError("Judge0 execution exceeded total deadline before submission.");
    }
    const subTimeout = Math.min(this.timeoutMs, subRemaining);

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
        signal: AbortSignal.timeout(subTimeout),
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
      if (submissionResponse.status === 401 || submissionResponse.status === 403) {
        throw new UpstreamError("Execution service authentication failed.", 502);
      }
      if (submissionResponse.status === 400) {
        throw new UpstreamError("Execution service rejected submission parameters.", 400);
      }
      throw new UpstreamError(
        `Execution service returned HTTP ${submissionResponse.status}.`,
        502
      );
    }

    const submissionData = await this._readBoundedJson(submissionResponse, "submission response");

    if (!submissionData || typeof submissionData !== "object") {
      throw new UpstreamError("Execution service returned malformed response.");
    }

    // Check if response is already finished (synchronous response)
    if (submissionData && submissionData.status && submissionData.status.id >= 3) {
      return this.normalizeResult(submissionData);
    }

    const token = submissionData?.token;
    if (!token) {
      throw new UpstreamError("Execution service did not return a submission token.");
    }

    // Poll for asynchronous result with overall deadline
    return this.pollResult(token, overallDeadline);
  }

  /**
   * Polls Judge0 for submission results until complete or timed out.
   *
   * @param {string} token
   * @param {number} [overallDeadline]
   * @returns {Promise<Object>} Normalized execution response.
   */
  async pollResult(token, overallDeadline = Date.now() + this.totalTimeoutMs) {
    const headers = this.getHeaders();
    const resultUrl = `${this.baseUrl}/submissions/${encodeURIComponent(
      token
    )}?base64_encoded=${this.useBase64}&fields=stdout,stderr,compile_output,message,status,time,memory`;

    for (let attempt = 1; attempt <= this.maxPollAttempts; attempt += 1) {
      const remainingBeforeSleep = overallDeadline - Date.now();
      if (remainingBeforeSleep <= 0) {
        throw new TimeoutError("Execution took too long to complete. Total deadline exceeded.");
      }

      await this.sleepFn(Math.min(this.pollIntervalMs, remainingBeforeSleep));

      const remainingForRequest = overallDeadline - Date.now();
      if (remainingForRequest <= 0) {
        throw new TimeoutError("Execution took too long to complete. Total deadline exceeded.");
      }

      const pollTimeout = Math.min(this.timeoutMs, remainingForRequest);

      let response;
      try {
        response = await this.fetchFn(resultUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(pollTimeout),
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
        if (response.status === 401 || response.status === 403) {
          throw new UpstreamError("Execution service authentication error during polling.", 502);
        }
        throw new UpstreamError(`Execution service poll returned HTTP ${response.status}.`);
      }

      const data = await this._readBoundedJson(response, "poll response");

      if (!data || typeof data !== "object") {
        throw new UpstreamError("Execution service poll returned malformed response.");
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
