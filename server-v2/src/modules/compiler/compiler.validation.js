"use strict";

const { resolveLanguage } = require("../../config/languages");

const MAX_SOURCE_CODE_LENGTH = 30000;
const MAX_STDIN_LENGTH = 10000;

/**
 * Validates the request body for POST /api/compiler/run.
 *
 * @param {Object} body
 * @returns {{
 *   isValid: boolean,
 *   error?: string,
 *   statusCode?: number,
 *   normalized?: {
 *     sourceCode: string,
 *     language: Object,
 *     stdin: string
 *   }
 * }}
 */
function validateRunCodeInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      isValid: false,
      statusCode: 400,
      error: "Request body must be a valid JSON object.",
    };
  }

  const { sourceCode, language, stdin = "" } = body;

  // 1. Source code validation
  if (sourceCode === undefined || sourceCode === null) {
    return {
      isValid: false,
      statusCode: 400,
      error: "Source code is required.",
    };
  }

  if (typeof sourceCode !== "string") {
    return {
      isValid: false,
      statusCode: 400,
      error: "Source code must be a string.",
    };
  }

  if (sourceCode.trim().length === 0) {
    return {
      isValid: false,
      statusCode: 400,
      error: "Source code cannot be empty.",
    };
  }

  if (sourceCode.length > MAX_SOURCE_CODE_LENGTH) {
    return {
      isValid: false,
      statusCode: 413,
      error: `Source code exceeds maximum allowed size of ${MAX_SOURCE_CODE_LENGTH.toLocaleString()} characters.`,
    };
  }

  // 2. Language validation
  if (language === undefined || language === null || typeof language !== "string" || !language.trim()) {
    return {
      isValid: false,
      statusCode: 400,
      error: "Programming language is required.",
    };
  }

  const resolved = resolveLanguage(language);
  if (!resolved) {
    return {
      isValid: false,
      statusCode: 400,
      error: "Unsupported programming language. Supported runtimes: C, C++, Java, Python, and JavaScript.",
    };
  }

  // 3. Stdin validation
  const resolvedStdin = stdin === undefined || stdin === null ? "" : stdin;

  if (typeof resolvedStdin !== "string") {
    return {
      isValid: false,
      statusCode: 400,
      error: "Standard input (stdin) must be a string.",
    };
  }

  if (resolvedStdin.length > MAX_STDIN_LENGTH) {
    return {
      isValid: false,
      statusCode: 400,
      error: `Standard input (stdin) exceeds maximum allowed size of ${MAX_STDIN_LENGTH.toLocaleString()} characters.`,
    };
  }

  return {
    isValid: true,
    normalized: {
      sourceCode,
      language: resolved,
      stdin: resolvedStdin,
    },
  };
}

module.exports = {
  MAX_SOURCE_CODE_LENGTH,
  MAX_STDIN_LENGTH,
  validateRunCodeInput,
};
