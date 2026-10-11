const { executeCode, getRuntimes, LANGUAGE_CONFIG } = require('../services/executionService');

// POST /api/execute
const runCode = async (req, res) => {
  try {
    const { language, code, stdin } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'No code provided for execution.',
      });
    }

    if (!language) {
      return res.status(400).json({
        success: false,
        message: 'Language must be specified.',
      });
    }

    const result = await executeCode(language, code, stdin || '');

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Execution controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to execute code.',
      error: error.message,
    });
  }
};

// GET /api/execute/runtimes
const listRuntimes = async (req, res) => {
  try {
    const runtimes = await getRuntimes();
    return res.status(200).json({
      success: true,
      data: {
        runtimes,
        supportedLanguages: Object.keys(LANGUAGE_CONFIG),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch runtime list.',
    });
  }
};

module.exports = {
  runCode,
  listRuntimes,
};
