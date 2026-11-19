"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Judge0Service } = require("../src/modules/compiler/judge0.service");
const { loadEnv } = require("../src/config/env");

test("Judge0 External Integration - Smoke test supported languages against live Judge0 (when reachable)", async (t) => {
  if (process.env.TEST_REAL_JUDGE0 !== "true") {
    t.skip("Skipping real Judge0 smoke test: TEST_REAL_JUDGE0 environment variable is not set to 'true'.");
    return;
  }

  let config;
  try {
    config = loadEnv();
  } catch {
    config = {
      judge0BaseUrl: process.env.JUDGE0_BASE_URL || "https://ce.judge0.com",
      judge0ApiKey: process.env.JUDGE0_API_KEY || null,
    };
  }

  const judge0Service = new Judge0Service({
    baseUrl: config.judge0BaseUrl,
    apiKey: config.judge0ApiKey,
    timeoutMs: 15000,
    pollIntervalMs: 1000,
    maxPollAttempts: 15,
  });

  // Probe live reachability first
  try {
    const probe = await fetch(`${judge0Service.baseUrl}/about`, {
      headers: judge0Service.getHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    if (!probe.ok) {
      t.skip(`Skipping real Judge0 smoke test: Live Judge0 returned HTTP ${probe.status}.`);
      return;
    }
  } catch (err) {
    t.skip(`Skipping real Judge0 smoke test: Live Judge0 is unreachable (${err.message}).`);
    return;
  }

  const testCases = [
    {
      name: "Python 3.12",
      languageId: 100,
      sourceCode: "print('Hello from Python')",
      expectedStdout: "Hello from Python\n",
    },
    {
      name: "JavaScript Node 22",
      languageId: 102,
      sourceCode: "console.log('Hello from JS');",
      expectedStdout: "Hello from JS\n",
    },
    {
      name: "C (GCC)",
      languageId: 103,
      sourceCode: "#include <stdio.h>\nint main(void) { printf(\"Hello from C\\n\"); return 0; }",
      expectedStdout: "Hello from C\n",
    },
    {
      name: "C++ (GCC)",
      languageId: 105,
      sourceCode: "#include <iostream>\nint main() { std::cout << \"Hello from C++\\n\"; return 0; }",
      expectedStdout: "Hello from C++\n",
    },
    {
      name: "Java 17",
      languageId: 91,
      sourceCode: "public class Main { public static void main(String[] args) { System.out.println(\"Hello from Java\"); } }",
      expectedStdout: "Hello from Java\n",
    },
  ];

  for (const tc of testCases) {
    const result = await judge0Service.execute({
      languageId: tc.languageId,
      sourceCode: tc.sourceCode,
    });

    assert.equal(result.status.id, 3, `${tc.name} should return Accepted status (id 3)`);
    assert.equal(result.stdout, tc.expectedStdout, `${tc.name} stdout should match`);
  }
});
