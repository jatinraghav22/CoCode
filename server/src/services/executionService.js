const axios = require('axios');

const JUDGE0_URL = process.env.JUDGE0_URL || 'https://ce.judge0.com';

// Map Monaco languages to Judge0 language IDs
const JUDGE0_LANGUAGE_MAP = {
  javascript: 63, // JavaScript (Node.js 12.14.0)
  typescript: 74, // TypeScript (3.7.4)
  python: 71,     // Python (3.8.1)
  cpp: 54,        // C++ (GCC 9.2.0)
  c: 50,          // C (GCC 9.2.0)
  java: 62,       // Java (OpenJDK 13.0.1)
  csharp: 51,     // C# (Mono 6.6.0.161)
  go: 60,         // Go (1.13.5)
  rust: 73,       // Rust (1.40.0)
  php: 68,        // PHP (7.4.1)
  ruby: 72,       // Ruby (2.7.0)
  bash: 46,       // Bash (5.0.0)
  perl: 85,       // Perl (5.28.1)
  r: 80,          // R (4.0.0)
  lua: 64,        // Lua (5.3.5)
  kotlin: 78,     // Kotlin (1.3.70)
  swift: 83,      // Swift (5.2.3)
};

/**
 * Execute code via Judge0 CE API
 * @param {string} language - Language identifier
 * @param {string} code - Source code to execute
 * @param {string} stdin - Standard input
 */
async function executeCode(language, code, stdin = '') {
  try {
    const langKey = (language || 'javascript').toLowerCase();
    const languageId = JUDGE0_LANGUAGE_MAP[langKey] || 63; // default to JS

    const payload = {
      source_code: code,
      language_id: languageId,
      stdin: stdin || '',
      cpu_time_limit: 5,
      memory_limit: 128000,
    };

    const response = await axios.post(`${JUDGE0_URL}/submissions?wait=true`, payload, {
      timeout: 20000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = response.data;
    const stdout = result.stdout || '';
    const stderr = result.stderr || '';
    const compileOutput = result.compile_output || '';
    const message = result.message || '';

    let output = '';
    let isError = false;

    if (compileOutput && compileOutput.trim()) {
      output = compileOutput;
      isError = true;
      return {
        success: false,
        phase: 'compilation',
        output: output.trim(),
        exitCode: 1,
        statusDescription: result.status?.description || 'Compilation Error',
      };
    }

    if (stderr && stderr.trim()) {
      output = stdout ? `${stdout}\n${stderr}` : stderr;
      isError = true;
    } else if (stdout) {
      output = stdout;
    } else if (message) {
      output = message;
      isError = true;
    } else {
      output = '(Program executed successfully with 0 output)';
    }

    return {
      success: !isError,
      phase: 'execution',
      output: output.trim(),
      exitCode: result.status?.id === 3 ? 0 : 1,
      statusDescription: result.status?.description || 'Executed',
      executionTime: result.time ? Math.round(parseFloat(result.time) * 1000) : null,
      memory: result.memory || null,
    };
  } catch (error) {
    console.error('Judge0 execution error:', error.message);
    const errDetail = error.response?.data?.message || error.message || 'Execution error';
    return {
      success: false,
      phase: 'service',
      output: `Code Execution Runner Error: ${errDetail}`,
      exitCode: -1,
    };
  }
}

async function getRuntimes() {
  try {
    const response = await axios.get(`${JUDGE0_URL}/languages`, { timeout: 8000 });
    return response.data;
  } catch (error) {
    return Object.keys(JUDGE0_LANGUAGE_MAP).map((k) => ({
      id: JUDGE0_LANGUAGE_MAP[k],
      name: k,
    }));
  }
}

module.exports = {
  executeCode,
  getRuntimes,
  JUDGE0_LANGUAGE_MAP,
};
