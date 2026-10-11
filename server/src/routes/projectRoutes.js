const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authmiddleware');
const {
  getUserProjects,
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  saveFile,
  deleteFile,
  createVersion,
  listVersions,
  restoreVersion,
} = require('../controllers/projectController');

// All project routes require authentication
router.use(authMiddleware);

router.get('/', getUserProjects);
router.post('/', createProject);
router.get('/:id', getProjectById);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

// Multi-file and folder management
router.post('/:id/files', saveFile);
router.delete('/:id/files/:fileId', deleteFile);

// Version history
router.post('/:id/versions', createVersion);
router.get('/:id/versions', listVersions);
router.post('/:id/versions/:versionId/restore', restoreVersion);

module.exports = router;
