const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authmiddleware');
const {
  getUserRooms,
  createRoom,
  joinRoom,
  getRoomById,
  saveWhiteboard,
} = require('../controllers/roomController');

router.use(authMiddleware);

router.get('/', getUserRooms);
router.post('/', createRoom);
router.post('/join', joinRoom);
router.get('/:id', getRoomById);
router.put('/:id/whiteboard', saveWhiteboard);

module.exports = router;
