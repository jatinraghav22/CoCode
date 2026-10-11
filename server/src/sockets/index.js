const prisma = require('../config/prisma');

// In-memory tracker for active room users: roomId -> Map(socketId -> userData)
const roomUsers = new Map();

const setupSockets = (io) => {
  io.on('connection', (socket) => {
    let currentRoomId = null;
    let currentUser = null;

    // User joins a collaboration room
    socket.on('join-room', async ({ roomId, user }) => {
      if (!roomId || !user) return;

      currentRoomId = roomId;
      currentUser = user;

      socket.join(roomId);

      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Map());
      }

      const usersMap = roomUsers.get(roomId);
      usersMap.set(socket.id, {
        socketId: socket.id,
        id: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        joinedAt: new Date(),
      });

      // Broadcast updated member list to everyone in room
      const activeUsersList = Array.from(usersMap.values());
      io.to(roomId).emit('room-users', activeUsersList);

      // System notification
      socket.to(roomId).emit('user-joined', {
        user,
        message: `${user.name} joined the room`,
      });
    });

    // Editor content changes
    socket.on('code-change', ({ roomId, fileId, content, sender }) => {
      if (!roomId) return;
      // Broadcast to other peers in room (exclude sender to prevent infinite loop)
      socket.to(roomId).emit('code-update', {
        fileId,
        content,
        sender,
      });
    });

    // Real-time cursor movement
    socket.on('cursor-change', ({ roomId, fileId, cursor, user }) => {
      if (!roomId) return;
      socket.to(roomId).emit('cursor-update', {
        fileId,
        cursor,
        user,
        socketId: socket.id,
      });
    });

    // Active file selection switch
    socket.on('active-file-change', ({ roomId, fileId, user }) => {
      if (!roomId) return;
      socket.to(roomId).emit('peer-active-file', {
        fileId,
        user,
      });
    });

    // Real-time chat message
    socket.on('send-message', async ({ roomId, content, user }) => {
      if (!roomId || !content || !content.trim()) return;

      try {
        // Persist message in database
        let savedMessage = null;
        if (user && user.id) {
          savedMessage = await prisma.message.create({
            data: {
              content: content.trim(),
              roomId,
              userId: user.id,
            },
            include: {
              user: {
                select: { id: true, name: true, username: true, avatar: true },
              },
            },
          });
        }

        const messageData = savedMessage || {
          id: `msg-${Date.now()}`,
          content: content.trim(),
          roomId,
          user,
          createdAt: new Date().toISOString(),
        };

        io.to(roomId).emit('new-message', messageData);
      } catch (error) {
        console.error('Socket message persist error:', error);
        // Fallback: emit message anyway
        io.to(roomId).emit('new-message', {
          id: `msg-${Date.now()}`,
          content: content.trim(),
          roomId,
          user,
          createdAt: new Date().toISOString(),
        });
      }
    });

    // Shared Drawing Board: real-time stroke drawing
    socket.on('draw-stroke', ({ roomId, strokeData }) => {
      if (!roomId) return;
      socket.to(roomId).emit('stroke-drawn', strokeData);
    });

    // Clear Whiteboard
    socket.on('clear-board', ({ roomId }) => {
      if (!roomId) return;
      socket.to(roomId).emit('board-cleared');
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
      if (currentRoomId && roomUsers.has(currentRoomId)) {
        const usersMap = roomUsers.get(currentRoomId);
        usersMap.delete(socket.id);

        if (usersMap.size === 0) {
          roomUsers.delete(currentRoomId);
        } else {
          io.to(currentRoomId).emit('room-users', Array.from(usersMap.values()));
          if (currentUser) {
            socket.to(currentRoomId).emit('user-left', {
              user: currentUser,
              message: `${currentUser.name} left the room`,
            });
          }
        }
      }
    });
  });
};

module.exports = setupSockets;
