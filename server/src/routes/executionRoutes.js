const express = require('express');
const router = express.Router();
const { runCode, listRuntimes } = require('../controllers/executionController');

// Code execution endpoint
router.post('/', runCode);

// Supported runtimes
router.get('/runtimes', listRuntimes);

module.exports = router;
