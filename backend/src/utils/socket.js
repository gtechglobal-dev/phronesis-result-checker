let io = null;

const users = {};

function setupSocket(httpServer) {
  const { Server } = require('socket.io');

  io = new Server(httpServer, {
    cors: {
      origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',').map(s => s.trim()),
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    const token = socket.handshake.auth?.token;
    if (!token) return socket.disconnect(true);
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      users[decoded.id] = socket.id;
      socket.data.user = decoded;
      socket.join(decoded.role);
    } catch {
      return socket.disconnect(true);
    }

    socket.on('disconnect', () => {
      for (const [uid, sid] of Object.entries(users)) {
        if (sid === socket.id) delete users[uid];
      }
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

function emitToRole(role, event, data) {
  getIO().to(role).emit(event, data);
}

function emitToUser(userId, event, data) {
  const sid = users[userId];
  if (sid) getIO().to(sid).emit(event, data);
}

function emitBroadcast(event, data) {
  getIO().emit(event, data);
}

module.exports = { setupSocket, getIO, emitToRole, emitToUser, emitBroadcast };
