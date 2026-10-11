require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const setupSockets = require('./sockets');
const prisma = require('./config/prisma');

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const server = http.createServer(app);

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      CLIENT_URL,
    ].filter(Boolean),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Attach socket event listeners
setupSockets(io);

// Start server
server.listen(PORT, async () => {
  console.log(`===============================================`);
  console.log(`🚀 CoCode Server running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO connected & ready for real-time collaboration`);
  console.log(`📡 Allowed Client URL: ${CLIENT_URL}`);
  console.log(`===============================================`);

  // Verify database connection gracefully
  try {
    await prisma.$connect();
    console.log(`✅ MySQL Database connected successfully via Prisma.`);
  } catch (dbError) {
    console.warn(`⚠️ MySQL Database connection notice: ${dbError.message}`);
    console.warn(`👉 Please verify DATABASE_URL in server/.env when running migrations.`);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received. Closing HTTP server & Prisma connection...');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('HTTP server and Prisma disconnected gracefully.');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Closing HTTP server...');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});
