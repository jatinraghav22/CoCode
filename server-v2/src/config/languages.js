"use strict";

/**
 * Authoritative language configurations verified against Judge0 CE runtime environments.
 *
 * Judge0 CE language IDs:
 * - C (GCC 14.1.0): 103
 * - C++ (GCC 14.1.0): 105
 * - Java (OpenJDK 17.0.6): 91
 * - Python (3.12.5): 100
 * - JavaScript (Node.js 22.08.0): 102
 */

const SUPPORTED_LANGUAGES = Object.freeze({
  c: Object.freeze({
    key: "c",
    name: "C",
    judge0Id: 103,
    runtime: "GCC 14.1.0",
    version: "14.1.0",
    extension: ".c",
    monacoLanguage: "c",
    aliases: Object.freeze(["c"]),
  }),
  cpp: Object.freeze({
    key: "cpp",
    name: "C++",
    judge0Id: 105,
    runtime: "GCC 14.1.0",
    version: "14.1.0",
    extension: ".cpp",
    monacoLanguage: "cpp",
    aliases: Object.freeze(["cpp", "c++"]),
  }),
  java: Object.freeze({
    key: "java",
    name: "Java",
    judge0Id: 91,
    runtime: "OpenJDK 17",
    version: "17.0.6",
    extension: ".java",
    monacoLanguage: "java",
    aliases: Object.freeze(["java"]),
  }),
  python: Object.freeze({
    key: "python",
    name: "Python",
    judge0Id: 100,
    runtime: "Python 3.12.5",
    version: "3.12.5",
    extension: ".py",
    monacoLanguage: "python",
    aliases: Object.freeze(["python", "py", "python3"]),
  }),
  javascript: Object.freeze({
    key: "javascript",
    name: "JavaScript",
    judge0Id: 102,
    runtime: "Node.js 22.08.0",
    version: "22.08.0",
    extension: ".js",
    monacoLanguage: "javascript",
    aliases: Object.freeze(["javascript", "js", "node"]),
  }),
});

/**
 * Resolves an incoming language string (e.g., 'python', 'py', 'C++', 'cpp')
 * to its canonical language definition.
 *
 * @param {string} langInput
 * @returns {Object|null}
 */
function resolveLanguage(langInput) {
  if (typeof langInput !== "string") {
    return null;
  }

  const normalized = langInput.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const lang of Object.values(SUPPORTED_LANGUAGES)) {
    if (lang.key === normalized || lang.aliases.includes(normalized)) {
      return lang;
    }
  }

  return null;
}

/**
 * Returns safe public metadata for all supported languages.
 * Never includes sensitive internal configuration.
 *
 * @returns {Array<Object>}
 */
function getSupportedLanguagesList() {
  return Object.values(SUPPORTED_LANGUAGES).map((lang) => ({
    key: lang.key,
    name: lang.name,
    runtime: lang.runtime,
    version: lang.version,
    extension: lang.extension,
    monacoLanguage: lang.monacoLanguage,
    judge0Id: lang.judge0Id,
    aliases: [...lang.aliases],
  }));
}

module.exports = {
  SUPPORTED_LANGUAGES,
  resolveLanguage,
  getSupportedLanguagesList,
};
