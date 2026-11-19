"use strict";

const { validateRunCodeInput } = require("./compiler.validation");

class CompilerController {
  /**
   * @param {Object} compilerService
   */
  constructor(compilerService) {
    if (!compilerService) {
      throw new Error("CompilerController requires a compilerService instance.");
    }
    this.compilerService = compilerService;
  }

  /**
   * GET /api/compiler/languages
   * Returns list of supported programming languages and runtime metadata.
   */
  getLanguages = async (req, res, next) => {
    try {
      const languages = this.compilerService.getSupportedLanguages();
      return res.status(200).json({
        success: true,
        languages,
      });
    } catch (error) {
      console.error("Get compiler languages error:", error.name, error.message.slice(0, 100));
      return res.status(500).json({
        success: false,
        message: "Internal server error while fetching supported languages.",
        error: "Internal server error while fetching supported languages.",
      });
    }
  };

  /**
   * POST /api/compiler/run
   * Submits code for execution and returns execution results.
   */
  runCode = async (req, res, next) => {
    try {
      const validation = validateRunCodeInput(req.body);
      if (!validation.isValid) {
        return res.status(validation.statusCode || 400).json({
          success: false,
          message: validation.error,
          error: validation.error,
        });
      }

      const result = await this.compilerService.runCode(validation.normalized);

      // Return both Backend V2 standard envelope and top-level fields for client compatibility
      return res.status(200).json({
        success: true,
        data: {
          status: result.status,
          stdout: result.stdout,
          stderr: result.stderr,
          compileOutput: result.compileOutput,
          message: result.message,
          time: result.time,
          memory: result.memory,
          language: result.language,
        },
        // Frontend compatibility fields
        status: result.status?.description || "Finished",
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        compileOutput: result.compileOutput || "",
        message: result.message || "",
        time: result.time,
        memory: result.memory,
      });
    } catch (error) {
      // Never log user source code, stdin, or API tokens
      console.error("Compiler execution error:", error.name, (error.message || "").slice(0, 150));

      if (error.statusCode === 504 || error.name === "TimeoutError") {
        return res.status(504).json({
          success: false,
          message: "The compiler service timed out. Please try again.",
          error: "The compiler service timed out. Please try again.",
        });
      }

      if (error.statusCode === 503 || error.name === "ServiceUnavailableError") {
        return res.status(503).json({
          success: false,
          message: "The compiler service is busy. Please try again shortly.",
          error: "The compiler service is busy. Please try again shortly.",
        });
      }

      if (error.statusCode === 502 || error.name === "UpstreamError") {
        return res.status(502).json({
          success: false,
          message: "Cannot reach the execution service. Check network connection.",
          error: "Cannot reach the execution service. Check network connection.",
        });
      }

      if (error.statusCode === 400) {
        return res.status(400).json({
          success: false,
          message: error.message,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error during code execution.",
        error: "Internal server error during code execution.",
      });
    }
  };
}

module.exports = { CompilerController };
