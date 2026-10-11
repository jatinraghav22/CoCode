const prisma = require('../config/prisma');

// Helper to generate a friendly unique room code like "CO-7K9A"
const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CO-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// GET /api/rooms - List rooms the user is member of or created
const getUserRooms = async (req, res) => {
  try {
    const rooms = await prisma.collaborationRoom.findMany({
      where: {
        OR: [
          { creatorId: req.user.id },
          { members: { some: { userId: req.user.id } } },
        ],
      },
      include: {
        creator: {
          select: { id: true, name: true, username: true, avatar: true },
        },
        project: {
          select: { id: true, title: true },
        },
        _count: {
          select: { members: true, messages: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: { rooms },
    });
  } catch (error) {
    console.error('getUserRooms error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch rooms.',
    });
  }
};

// POST /api/rooms - Create new room
const createRoom = async (req, res) => {
  try {
    const { name, description, projectId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Room name is required.',
      });
    }

    let roomCode = generateRoomCode();
    let exists = await prisma.collaborationRoom.findUnique({ where: { roomCode } });
    while (exists) {
      roomCode = generateRoomCode();
      exists = await prisma.collaborationRoom.findUnique({ where: { roomCode } });
    }

    // If projectId provided, check user has access to it
    if (projectId) {
      const proj = await prisma.project.findFirst({
        where: { id: projectId, userId: req.user.id },
      });
      if (!proj) {
        return res.status(404).json({
          success: false,
          message: 'Specified project not found or not owned by you.',
        });
      }
    }

    const room = await prisma.collaborationRoom.create({
      data: {
        roomCode,
        name: name.trim(),
        description: description ? description.trim() : null,
        creatorId: req.user.id,
        projectId: projectId || null,
        members: {
          create: {
            userId: req.user.id,
            role: 'ADMIN',
          },
        },
      },
      include: {
        creator: {
          select: { id: true, name: true, username: true, avatar: true },
        },
        project: {
          include: { files: true },
        },
        members: {
          include: {
            user: { select: { id: true, name: true, username: true, avatar: true } },
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Room created successfully.',
      data: { room },
    });
  } catch (error) {
    console.error('createRoom error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create room.',
      error: error.message,
    });
  }
};

// POST /api/rooms/join - Join room by code
const joinRoom = async (req, res) => {
  try {
    const { roomCode } = req.body;

    if (!roomCode) {
      return res.status(400).json({
        success: false,
        message: 'Room code is required.',
      });
    }

    const cleanCode = roomCode.trim().toUpperCase();

    const room = await prisma.collaborationRoom.findUnique({
      where: { roomCode: cleanCode },
      include: {
        creator: {
          select: { id: true, name: true, username: true, avatar: true },
        },
        project: {
          include: { files: true },
        },
        members: {
          include: {
            user: { select: { id: true, name: true, username: true, avatar: true } },
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: `No active room found with code "${cleanCode}".`,
      });
    }

    // Check if user is already a member
    const existingMember = room.members.find((m) => m.userId === req.user.id);
    if (!existingMember) {
      await prisma.roomMember.create({
        data: {
          roomId: room.id,
          userId: req.user.id,
          role: 'MEMBER',
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Joined room successfully.',
      data: { room },
    });
  } catch (error) {
    console.error('joinRoom error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to join room.',
    });
  }
};

// GET /api/rooms/:id - Get room by ID or roomCode
const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;

    const room = await prisma.collaborationRoom.findFirst({
      where: {
        OR: [{ id }, { roomCode: id.toUpperCase() }],
      },
      include: {
        creator: {
          select: { id: true, name: true, username: true, avatar: true },
        },
        project: {
          include: {
            files: {
              orderBy: [{ isFolder: 'desc' }, { name: 'asc' }],
            },
            versions: {
              select: { id: true, name: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        members: {
          include: {
            user: { select: { id: true, name: true, username: true, avatar: true } },
          },
        },
        messages: {
          include: {
            user: { select: { id: true, name: true, username: true, avatar: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: 100,
        },
      },
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: { room },
    });
  } catch (error) {
    console.error('getRoomById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get room details.',
    });
  }
};

// PUT /api/rooms/:id/whiteboard - Save whiteboard snapshot
const saveWhiteboard = async (req, res) => {
  try {
    const { id } = req.params;
    const { whiteboard } = req.body;

    await prisma.collaborationRoom.update({
      where: { id },
      data: { whiteboard },
    });

    return res.status(200).json({
      success: true,
      message: 'Whiteboard saved.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to save whiteboard.',
    });
  }
};

module.exports = {
  getUserRooms,
  createRoom,
  joinRoom,
  getRoomById,
  saveWhiteboard,
};
