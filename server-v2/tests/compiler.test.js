"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SUPPORTED_LANGUAGES,
  resolveLanguage,
  getSupportedLanguagesList,
} = require("../src/config/languages");
const {
  validateRunCodeInput,
  MAX_SOURCE_CODE_LENGTH,
  MAX_STDIN_LENGTH,
} = require("../src/modules/compiler/compiler.validation");
const {
  Judge0Service,
  UpstreamError,
  TimeoutError,
  ServiceUnavailableError,
} = require("../src/modules/compiler/judge0.service");
const { CompilerService } = require("../src/modules/compiler/compiler.service");

// ============================================================================
// 1. Language Configuration & Allowlist Tests
// ============================================================================

test("Languages - allowlist defines the 5 supported languages with correct Judge0 IDs", () => {
  assert.equal(SUPPORTED_LANGUAGES.c.judge0Id, 103);
  assert.equal(SUPPORTED_LANGUAGES.cpp.judge0Id, 105);
  assert.equal(SUPPORTED_LANGUAGES.java.judge0Id, 91);
  assert.equal(SUPPORTED_LANGUAGES.python.judge0Id, 100);
  assert.equal(SUPPORTED_LANGUAGES.javascript.judge0Id, 102);
});

test("Languages - resolveLanguage recognizes canonical names and aliases", () => {
  // Canonical keys
  assert.equal(resolveLanguage("c")?.key, "c");
  assert.equal(resolveLanguage("cpp")?.key, "cpp");
  assert.equal(resolveLanguage("java")?.key, "java");
  assert.equal(resolveLanguage("python")?.key, "python");
  assert.equal(resolveLanguage("javascript")?.key, "javascript");

  // Aliases & case insensitivity
  assert.equal(resolveLanguage("C++")?.key, "cpp");
  assert.equal(resolveLanguage("py")?.key, "python");
  assert.equal(resolveLanguage("PYTHON3")?.key, "python");
  assert.equal(resolveLanguage("js")?.key, "javascript");
  assert.equal(resolveLanguage("Node")?.key, "javascript");
  assert.equal(resolveLanguage("  python  ")?.key, "python");

  // Unsupported or invalid languages
  assert.equal(resolveLanguage("ruby"), null);
  assert.equal(resolveLanguage("rust"), null);
  assert.equal(resolveLanguage("go"), null);
  assert.equal(resolveLanguage(""), null);
  assert.equal(resolveLanguage(null), null);
  assert.equal(resolveLanguage(123), null);
});

test("Languages - getSupportedLanguagesList returns safe metadata without private config", () => {
  const list = getSupportedLanguagesList();
  assert.equal(Array.isArray(list), true);
  assert.equal(list.length, 5);

  const keys = list.map((l) => l.key);
  assert.deepEqual(keys.sort(), ["c", "cpp", "java", "javascript", "python"].sort());

  for (const item of list) {
    assert.ok(item.key);
    assert.ok(item.name);
    assert.ok(item.runtime);
    assert.ok(item.version);
    assert.ok(item.extension);
    assert.ok(item.judge0Id);
    assert.ok(Array.isArray(item.aliases));
    // Verify no private credentials exist
    assert.equal(item.apiKey, undefined);
    assert.equal(item.token, undefined);
    assert.equal(item.baseUrl, undefined);
  }
});

// ============================================================================
// 2. Request Validation Tests
// ============================================================================

test("Validation - validateRunCodeInput accepts valid payload", () => {
  const res = validateRunCodeInput({
    language: "python",
    sourceCode: "print('Hello')",
    stdin: "test input",
  });

  assert.equal(res.isValid, true);
  assert.equal(res.normalized.language.key, "python");
  assert.equal(res.normalized.sourceCode, "print('Hello')");
  assert.equal(res.normalized.stdin, "test input");
});

test("Validation - validateRunCodeInput defaults stdin to empty string when omitted", () => {
  const res = validateRunCodeInput({
    language: "cpp",
    sourceCode: "int main() { return 0; }",
  });

  assert.equal(res.isValid, true);
  assert.equal(res.normalized.stdin, "");
});

test("Validation - rejects non-object or array body", () => {
  assert.equal(validateRunCodeInput(null).isValid, false);
  assert.equal(validateRunCodeInput("string").isValid, false);
  assert.equal(validateRunCodeInput([]).isValid, false);
});

test("Validation - rejects missing or empty source code", () => {
  // Missing
  const resMissing = validateRunCodeInput({ language: "python" });
  assert.equal(resMissing.isValid, false);
  assert.equal(resMissing.statusCode, 400);

  // Null
  const resNull = validateRunCodeInput({ language: "python", sourceCode: null });
  assert.equal(resNull.isValid, false);
  assert.equal(resNull.statusCode, 400);

  // Whitespace only
  const resEmpty = validateRunCodeInput({ language: "python", sourceCode: "   \n\t  " });
  assert.equal(resEmpty.isValid, false);
  assert.equal(resEmpty.statusCode, 400);
  assert.match(resEmpty.error, /cannot be empty/i);

  // Non-string
  const resNumber = validateRunCodeInput({ language: "python", sourceCode: 12345 });
  assert.equal(resNumber.isValid, false);
  assert.equal(resNumber.statusCode, 400);
});

test("Validation - rejects source code exceeding 30,000 characters with 413", () => {
  const largeCode = "a".repeat(MAX_SOURCE_CODE_LENGTH + 1);
  const res = validateRunCodeInput({ language: "python", sourceCode: largeCode });

  assert.equal(res.isValid, false);
  assert.equal(res.statusCode, 413);
  assert.match(res.error, /exceeds maximum allowed size/i);
});

test("Validation - rejects missing or unsupported language", () => {
  const resMissing = validateRunCodeInput({ sourceCode: "print('hi')" });
  assert.equal(resMissing.isValid, false);
  assert.equal(resMissing.statusCode, 400);

  const resUnsupported = validateRunCodeInput({ sourceCode: "print('hi')", language: "pascal" });
  assert.equal(resUnsupported.isValid, false);
  assert.equal(resUnsupported.statusCode, 400);
  assert.match(resUnsupported.error, /unsupported/i);
});

test("Validation - rejects non-string or oversized stdin", () => {
  const resNonString = validateRunCodeInput({
    sourceCode: "print('hi')",
    language: "python",
    stdin: 123,
  });
  assert.equal(resNonString.isValid, false);
  assert.equal(resNonString.statusCode, 400);

  const largeStdin = "x".repeat(MAX_STDIN_LENGTH + 1);
  const resOversized = validateRunCodeInput({
    sourceCode: "print('hi')",
    language: "python",
    stdin: largeStdin,
  });
  assert.equal(resOversized.isValid, false);
  assert.equal(resOversized.statusCode, 400);
});

// ============================================================================
// 3. Judge0Service Unit Tests
// ============================================================================

test("Judge0Service - base64 encoding and decoding handles unicode safely", () => {
  const service = new Judge0Service();
  const rawText = "Hello 🌍! console.log('test'); <>&\"'";
  const encoded = service.encodeBase64(rawText);
  const decoded = service.decodeBase64(encoded);

  assert.equal(decoded, rawText);
  assert.equal(service.decodeBase64(null), null);
  assert.equal(service.decodeBase64(""), null);
});

test("Judge0Service - constructs request headers with and without API key", () => {
  const serviceNoKey = new Judge0Service({
    baseUrl: "https://ce.judge0.com",
    apiKey: null,
  });
  const headersNoKey = serviceNoKey.getHeaders();
  assert.equal(headersNoKey["Content-Type"], "application/json");
  assert.equal(headersNoKey["X-Auth-Token"], undefined);

  const serviceWithKey = new Judge0Service({
    baseUrl: "https://judge0-ce.p.rapidapi.com",
    apiKey: "secret_api_key_123",
  });
  const headersWithKey = serviceWithKey.getHeaders();
  assert.equal(headersWithKey["Content-Type"], "application/json");
  assert.equal(headersWithKey["X-Auth-Token"], "secret_api_key_123");
  assert.equal(headersWithKey["X-RapidAPI-Key"], "secret_api_key_123");
  assert.equal(headersWithKey["X-RapidAPI-Host"], "judge0-ce.p.rapidapi.com");
});

test("Judge0Service - handles synchronous submission response (immediate result)", async () => {
  const mockFetch = async (url, options) => {
    assert.match(url, /\/submissions/);
    const body = JSON.parse(options.body);
    assert.equal(body.language_id, 100);
    assert.equal(body.cpu_time_limit, 2);
    assert.equal(body.enable_network, false);

    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: { id: 3, description: "Accepted" },
        stdout: Buffer.from("Hello from Python!\n").toString("base64"),
        stderr: null,
        compile_output: null,
        time: "0.021",
        memory: 3200,
      }),
    };
  };

  const service = new Judge0Service({ fetchFn: mockFetch, useBase64: true });
  const result = await service.execute({
    languageId: 100,
    sourceCode: "print('Hello from Python!')",
  });

  assert.equal(result.status.id, 3);
  assert.equal(result.status.description, "Accepted");
  assert.equal(result.stdout, "Hello from Python!\n");
  assert.equal(result.stderr, null);
  assert.equal(result.time, "0.021");
  assert.equal(result.memory, 3200);
});

test("Judge0Service - handles asynchronous polling with completion", async () => {
  let callCount = 0;
  const mockFetch = async (url) => {
    callCount += 1;
    if (callCount === 1) {
      // Submission response with token
      return {
        ok: true,
        status: 201,
        json: async () => ({ token: "mock-token-abc" }),
      };
    }

    if (callCount === 2) {
      // Polling attempt 1: In Queue (status 1)
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: { id: 1, description: "In Queue" },
        }),
      };
    }

    if (callCount === 3) {
      // Polling attempt 2: Processing (status 2)
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: { id: 2, description: "Processing" },
        }),
      };
    }

    // Polling attempt 3: Finished (status 3: Accepted)
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: { id: 3, description: "Accepted" },
        stdout: Buffer.from("42\n").toString("base64"),
        stderr: null,
        compile_output: null,
        time: "0.015",
        memory: 1540,
      }),
    };
  };

  const service = new Judge0Service({
    fetchFn: mockFetch,
    sleepFn: async () => {}, // Instant sleep for tests
    useBase64: true,
    maxPollAttempts: 5,
  });

  const result = await service.execute({
    languageId: 102,
    sourceCode: "console.log(42)",
  });

  assert.equal(callCount, 4);
  assert.equal(result.status.id, 3);
  assert.equal(result.stdout, "42\n");
  assert.equal(result.time, "0.015");
});

test("Judge0Service - handles compilation error execution result correctly", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      status: { id: 6, description: "Compilation Error" },
      stdout: null,
      stderr: null,
      compile_output: Buffer.from("error: expected ';' before 'return'").toString("base64"),
      time: null,
      memory: null,
    }),
  });

  const service = new Judge0Service({ fetchFn: mockFetch, useBase64: true });
  const result = await service.execute({
    languageId: 105,
    sourceCode: "int main() { int x = 5 return 0; }",
  });

  assert.equal(result.status.id, 6);
  assert.equal(result.status.description, "Compilation Error");
  assert.equal(result.compileOutput, "error: expected ';' before 'return'");
  assert.equal(result.stdout, null);
});

test("Judge0Service - handles runtime error execution result correctly", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      status: { id: 11, description: "Runtime Error (NZEC)" },
      stdout: null,
      stderr: Buffer.from("ZeroDivisionError: division by zero").toString("base64"),
      compile_output: null,
      time: "0.03",
      memory: 2000,
    }),
  });

  const service = new Judge0Service({ fetchFn: mockFetch, useBase64: true });
  const result = await service.execute({
    languageId: 100,
    sourceCode: "1/0",
  });

  assert.equal(result.status.id, 11);
  assert.equal(result.status.description, "Runtime Error (NZEC)");
  assert.equal(result.stderr, "ZeroDivisionError: division by zero");
});

test("Judge0Service - throws TimeoutError when polling attempts are exhausted", async () => {
  let callCount = 0;
  const mockFetch = async () => {
    callCount += 1;
    if (callCount === 1) {
      return { ok: true, status: 201, json: async () => ({ token: "pending-tok" }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: { id: 2, description: "Processing" } }),
    };
  };

  const service = new Judge0Service({
    fetchFn: mockFetch,
    sleepFn: async () => {},
    maxPollAttempts: 3,
  });

  await assert.rejects(
    async () => {
      await service.execute({ languageId: 100, sourceCode: "while True: pass" });
    },
    (err) => {
      assert.equal(err.name, "TimeoutError");
      assert.equal(err.statusCode, 504);
      return true;
    }
  );
});

test("Judge0Service - throws UpstreamError when execution service is unreachable", async () => {
  const mockFetch = async () => {
    const err = new TypeError("fetch failed: ECONNREFUSED");
    throw err;
  };

  const service = new Judge0Service({ fetchFn: mockFetch });

  await assert.rejects(
    async () => {
      await service.execute({ languageId: 100, sourceCode: "print(1)" });
    },
    (err) => {
      assert.equal(err.name, "UpstreamError");
      assert.equal(err.statusCode, 502);
      return true;
    }
  );
});

test("Judge0Service - throws ServiceUnavailableError when rate limited (429)", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ error: "Rate limit exceeded" }),
  });

  const service = new Judge0Service({ fetchFn: mockFetch });

  await assert.rejects(
    async () => {
      await service.execute({ languageId: 100, sourceCode: "print(1)" });
    },
    (err) => {
      assert.equal(err.name, "ServiceUnavailableError");
      assert.equal(err.statusCode, 503);
      return true;
    }
  );
});

// ============================================================================
// 4. CompilerService Unit Tests
// ============================================================================

test("CompilerService - runCode resolves language and enriches result with language key", async () => {
  const mockJudge0 = {
    execute: async ({ languageId, sourceCode, stdin }) => {
      assert.equal(languageId, 102); // JavaScript
      return {
        status: { id: 3, description: "Accepted" },
        stdout: "Result: 10\n",
        stderr: null,
        compileOutput: null,
        time: "0.01",
        memory: 1200,
      };
    },
  };

  const service = new CompilerService({ judge0Service: mockJudge0 });
  const result = await service.runCode({
    language: "node", // alias
    sourceCode: "console.log('Result: 10');",
  });

  assert.equal(result.language, "javascript");
  assert.equal(result.status.description, "Accepted");
  assert.equal(result.stdout, "Result: 10\n");
});

test("CompilerService - runCode rejects unsupported language with 400", async () => {
  const service = new CompilerService({ judge0Service: {} });

  await assert.rejects(
    async () => {
      await service.runCode({
        language: "unsupported_lang",
        sourceCode: "echo 1",
      });
    },
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /unsupported/i);
      return true;
    }
  );
});
