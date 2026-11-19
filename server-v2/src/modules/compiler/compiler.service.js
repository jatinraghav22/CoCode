"use strict";

const {
  resolveLanguage,
  getSupportedLanguagesList,
} = require("../../config/languages");
const { Judge0Service } = require("./judge0.service");

class CompilerService {
  /**
   * @param {Object} [options]
   * @param {Judge0Service} [options.judge0Service]
   */
  constructor(options = {}) {
    this.judge0Service = options.judge0Service || new Judge0Service();
  }

  /**
   * Returns safe metadata for all supported languages.
   * @returns {Array<Object>}
   */
  getSupportedLanguages() {
    return getSupportedLanguagesList();
  }

  /**
   * Executes source code using Judge0.
   *
   * @param {Object} params
   * @param {string|Object} params.language - Language key/alias or resolved language object.
   * @param {string} params.sourceCode - Code to execute.
   * @param {string} [params.stdin=""] - Custom standard input.
   * @returns {Promise<Object>} Execution result.
   */
  async runCode({ language, sourceCode, stdin = "" }) {
    const resolvedLang =
      typeof language === "object" && language !== null && language.judge0Id
        ? language
        : resolveLanguage(language);

    if (!resolvedLang) {
      const err = new Error("Unsupported programming language.");
      err.statusCode = 400;
      throw err;
    }

    const result = await this.judge0Service.execute({
      languageId: resolvedLang.judge0Id,
      sourceCode,
      stdin,
    });

    return {
      ...result,
      language: resolvedLang.key,
    };
  }
}

module.exports = { CompilerService };
