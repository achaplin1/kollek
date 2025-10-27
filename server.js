const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { nanoid } = require('nanoid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kollek-secret-admin-pass';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

function createRoom(adminName) {
  const roomId = nanoid(6).toUpperCase();
  const adminToken = nanoid(16);
  rooms.set(roomId, {
    adminToken,
    adminName,
    heads: [],
    players: new Map(),
    currentRound: null,
    createdAt: Date.now()
  });
  return { roomId, adminToken };
}

function getPublicHeads(room) {
  return room.heads.map(({ id, name, imageUrl }) => ({ id, name, imageUrl }));
}

app.post('/api/create-room', (req, res) => {
  const { password, adminName } = req.body;
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Mot de passe invalide.' });
  }
  if (!adminName) {
    return res.status(400).json({ error: 'Le nom de l\'admin est requis.' });
  }
  const { roomId, adminToken } = createRoom(adminName);
  res.json({ roomId, adminToken });
});

app.post('/api/join-room', (req, res) => {
  const { roomId, name } = req.body;
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Salon introuvable.' });
  }
  if (!name) {
    return res.status(400).json({ error: 'Le nom est requis.' });
  }
  res.json({ success: true });
});

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, name, adminToken }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('joinError', 'Salon introuvable.');
      return;
    }

    const isAdmin = adminToken && adminToken === room.adminToken;
    const existingPlayer = room.players.get(socket.id);
    if (existingPlayer) {
      existingPlayer.name = name;
      existingPlayer.isAdmin = isAdmin;
    } else {
      room.players.set(socket.id, {
        id: socket.id,
        name,
        isAdmin,
        hasVoted: false,
        vote: null
      });
    }

    socket.join(roomId);
    socket.data = { roomId, name, isAdmin };

    socket.emit('joined', {
      roomId,
      name,
      isAdmin,
      heads: getPublicHeads(room),
      players: Array.from(room.players.values()).map(({ id, name: playerName, isAdmin: admin }) => ({
        id,
        name: playerName,
        isAdmin: admin
      })),
      currentRound: room.currentRound
        ? {
            question: room.currentRound.question,
            headIds: room.currentRound.headIds,
            votes: room.currentRound.revealed ? room.currentRound.votes : null,
            status: room.currentRound.status
          }
        : null
    });

    io.to(roomId).emit('playersUpdated', Array.from(room.players.values()).map(({ id, name: playerName, isAdmin: admin }) => ({
      id,
      name: playerName,
      isAdmin: admin
    })));
  });

  socket.on('addHead', ({ roomId, adminToken, name, imageUrl }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminToken !== adminToken) return;
    if (!name || !imageUrl) return;
    room.heads.push({ id: nanoid(8), name, imageUrl });
    io.to(roomId).emit('headsUpdated', getPublicHeads(room));
  });

  socket.on('removeHead', ({ roomId, adminToken, headId }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminToken !== adminToken) return;
    room.heads = room.heads.filter((head) => head.id !== headId);
    io.to(roomId).emit('headsUpdated', getPublicHeads(room));
  });

  socket.on('startRound', ({ roomId, adminToken, question, headIds }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminToken !== adminToken) return;
    if (!question || !Array.isArray(headIds) || headIds.length === 0) return;

    const availableHeads = new Set(room.heads.map((head) => head.id));
    const invalidSelection = headIds.some((id) => !availableHeads.has(id));
    if (invalidSelection) return;

    const players = Array.from(room.players.values());
    if (players.length === 0) return;

    room.currentRound = {
      question,
      headIds,
      votes: {},
      voters: new Set(),
      status: 'voting',
      revealed: false
    };

    headIds.forEach((id) => {
      room.currentRound.votes[id] = 0;
    });

    io.to(roomId).emit('roundStarted', {
      question,
      heads: room.heads.filter((head) => headIds.includes(head.id))
    });
  });

  socket.on('castVote', ({ roomId, headId }) => {
    const room = rooms.get(roomId);
    if (!room || !room.currentRound || room.currentRound.status !== 'voting') return;

    const player = room.players.get(socket.id);
    if (!player || room.currentRound.voters.has(player.id)) return;
    if (!room.currentRound.headIds.includes(headId)) return;

    room.currentRound.voters.add(player.id);
    room.currentRound.votes[headId] += 1;
    player.hasVoted = true;
    player.vote = headId;

    const totalPlayers = room.players.size;
    if (room.currentRound.voters.size >= totalPlayers) {
      room.currentRound.status = 'reveal';
      setTimeout(() => {
        room.currentRound.status = 'results';
        room.currentRound.revealed = true;
        const results = Object.entries(room.currentRound.votes)
          .map(([id, count]) => {
            const head = room.heads.find((h) => h.id === id);
            return {
              id,
              count,
              name: head ? head.name : 'Inconnu',
              imageUrl: head ? head.imageUrl : ''
            };
          })
          .sort((a, b) => b.count - a.count);
        io.to(roomId).emit('roundResults', { results });
      }, 2000);
      io.to(roomId).emit('allVotesIn');
    } else {
      io.to(roomId).emit('voteProgress', {
        current: room.currentRound.voters.size,
        total: totalPlayers
      });
    }
  });

  socket.on('endRound', ({ roomId, adminToken }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminToken !== adminToken || !room.currentRound) return;
    room.currentRound = null;
    room.players.forEach((player) => {
      player.hasVoted = false;
      player.vote = null;
    });
    io.to(roomId).emit('roundEnded');
  });

  socket.on('disconnect', () => {
    const { roomId } = socket.data || {};
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.players.delete(socket.id);

    if (room.players.size === 0) {
      rooms.delete(roomId);
      return;
    }

    io.to(roomId).emit('playersUpdated', Array.from(room.players.values()).map(({ id, name, isAdmin }) => ({
      id,
      name,
      isAdmin
    })));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
