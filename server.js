const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { nanoid } = require('nanoid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kollek-secret-admin-pass';

const DATA_DIR = path.join(__dirname, 'data');
const HEADS_PRESET_PATH = path.join(DATA_DIR, 'heads.json');
const QUESTIONS_PRESET_PATH = path.join(DATA_DIR, 'questions.json');

const DEFAULT_HEADS_PRESET = [
  {
    name: 'anna',
    imageUrl: 'https://i.pravatar.cc/200?img=65'
  },
  {
    name: 'alex',
    imageUrl: 'https://i.pravatar.cc/200?img=12'
  },
  {
    name: 'milo',
    imageUrl: 'https://i.pravatar.cc/200?img=33'
  }
];

const DEFAULT_QUESTIONS_PRESET = [
  'Qui est le plus susceptible de lancer une impro musicale ?',
  'Qui oublie toujours ses clés ?'
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readPreset(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

function writePreset(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

ensureDataDir();

let headPresets = readPreset(HEADS_PRESET_PATH, DEFAULT_HEADS_PRESET);
let questionPresets = readPreset(QUESTIONS_PRESET_PATH, DEFAULT_QUESTIONS_PRESET);

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
    questions: [],
    players: new Map(),
    currentRound: null,
    questionDeck: [],
    usedQuestionIds: new Set(),
    roundNumber: 0,
    createdAt: Date.now()
  });
  return { roomId, adminToken };
}

function getPublicHeads(room) {
  return room.heads.map(({ id, name, imageUrl }) => ({ id, name, imageUrl }));
}

function getPublicQuestions(room) {
  return room.questions.map(({ id, text }) => ({ id, text }));
}

function shuffle(array) {
  const clone = array.slice();
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function sanitizeHeadPresets(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      const imageUrl = typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '';
      if (!name || !imageUrl) return null;
      return { name, imageUrl };
    })
    .filter(Boolean);
}

function sanitizeQuestionPresets(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim();
      }
      if (item && typeof item === 'object' && typeof item.text === 'string') {
        return item.text.trim();
      }
      return '';
    })
    .filter((text) => text.length > 0);
}

function ensureQuestionTracking(room) {
  if (!room.usedQuestionIds || typeof room.usedQuestionIds.size !== 'number') {
    room.usedQuestionIds = new Set(
      Array.isArray(room.usedQuestionIds) ? room.usedQuestionIds : []
    );
  }
  if (!Array.isArray(room.questionDeck)) {
    room.questionDeck = [];
  }
}

function rebuildQuestionDeck(room, { resetUsed = false } = {}) {
  ensureQuestionTracking(room);
  if (resetUsed) {
    room.usedQuestionIds = new Set();
  }
  const availableIds = room.questions
    .map((question) => question.id)
    .filter((id) => !room.usedQuestionIds.has(id));
  room.questionDeck = shuffle(availableIds);
}

function roomHeadsFromPresets(raw) {
  return sanitizeHeadPresets(raw).map((entry) => ({
    id: nanoid(8),
    name: entry.name,
    imageUrl: entry.imageUrl
  }));
}

function roomQuestionsFromPresets(raw) {
  return sanitizeQuestionPresets(raw).map((text) => ({
    id: nanoid(8),
    text
  }));
}

function findRoomByToken(token) {
  if (!token) return null;
  for (const [roomId, room] of rooms.entries()) {
    if (room.adminToken === token) {
      return { roomId, room };
    }
  }
  return null;
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

app.get('/api/presets', (req, res) => {
  res.json({ heads: headPresets, questions: questionPresets });
});

app.post('/api/presets', (req, res) => {
  const token = req.headers['x-admin-token'];
  const match = findRoomByToken(token);
  if (!match) {
    return res.status(403).json({ error: 'Non autorisé.' });
  }
  const headsInput = Array.isArray(req.body.heads) ? req.body.heads : headPresets;
  const questionsInput = Array.isArray(req.body.questions) ? req.body.questions : questionPresets;
  headPresets = sanitizeHeadPresets(headsInput);
  questionPresets = sanitizeQuestionPresets(questionsInput);
  writePreset(HEADS_PRESET_PATH, headPresets);
  writePreset(QUESTIONS_PRESET_PATH, questionPresets);
  res.json({ heads: headPresets, questions: questionPresets });
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

    const payload = {
      roomId,
      name,
      isAdmin,
      heads: getPublicHeads(room),
      questions: getPublicQuestions(room),
      players: Array.from(room.players.values()).map(({ id, name: playerName, isAdmin: admin }) => ({
        id,
        name: playerName,
        isAdmin: admin
      })),
      roundNumber: room.roundNumber,
      currentRound: room.currentRound
        ? {
            question: room.currentRound.question,
            headIds: room.currentRound.headIds,
            votes: room.currentRound.revealed ? room.currentRound.votes : null,
            status: room.currentRound.status
          }
        : null
    };

    socket.emit('joined', payload);

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

  socket.on('replaceHeads', ({ roomId, adminToken, heads }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminToken !== adminToken) return;
    const normalized = roomHeadsFromPresets(Array.isArray(heads) ? heads : []);
    room.heads = normalized;
    if (room.currentRound && room.currentRound.status !== 'finished') {
      room.currentRound = null;
      room.players.forEach((player) => {
        player.hasVoted = false;
        player.vote = null;
      });
      io.to(roomId).emit('roundEnded');
    }
    io.to(roomId).emit('headsUpdated', getPublicHeads(room));
  });

  socket.on('addQuestion', ({ roomId, adminToken, text }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminToken !== adminToken) return;
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    room.questions.push({ id: nanoid(8), text: trimmed });
    rebuildQuestionDeck(room);
    io.to(roomId).emit('questionsUpdated', getPublicQuestions(room));
  });

  socket.on('removeQuestion', ({ roomId, adminToken, questionId }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminToken !== adminToken) return;
    room.questions = room.questions.filter((question) => question.id !== questionId);
    ensureQuestionTracking(room);
    room.usedQuestionIds.delete(questionId);
    rebuildQuestionDeck(room);
    io.to(roomId).emit('questionsUpdated', getPublicQuestions(room));
  });

  socket.on('replaceQuestions', ({ roomId, adminToken, questions }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminToken !== adminToken) return;
    const normalized = roomQuestionsFromPresets(Array.isArray(questions) ? questions : []);
    room.questions = normalized;
    rebuildQuestionDeck(room, { resetUsed: true });
    io.to(roomId).emit('questionsUpdated', getPublicQuestions(room));
  });

  socket.on('startRound', ({ roomId, adminToken }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminToken !== adminToken) return;

    if (room.currentRound && room.currentRound.status !== 'finished') {
      socket.emit('roundError', 'Une manche est déjà en cours.');
      return;
    }

    if (room.currentRound && room.currentRound.status === 'finished') {
      room.currentRound = null;
    }

    if (room.heads.length === 0 || room.questions.length === 0) {
      socket.emit('roundError', 'Ajoute au moins une tête et une question.');
      return;
    }

    if (room.players.size === 0) {
      socket.emit('roundError', 'Attends qu\'au moins un joueur soit connecté.');
      return;
    }

    ensureQuestionTracking(room);
    const availableQuestionIds = room.questions
      .map((question) => question.id)
      .filter((id) => !room.usedQuestionIds.has(id));

    room.questionDeck = (room.questionDeck || []).filter((id) => availableQuestionIds.includes(id));

    if (room.questionDeck.length === 0) {
      room.questionDeck = shuffle(availableQuestionIds);
    }

    if (room.questionDeck.length === 0) {
      socket.emit('roundError', 'Plus de questions disponibles. Ajoute-en pour continuer !');
      return;
    }

    const questionId = room.questionDeck.pop();
    room.usedQuestionIds.add(questionId);
    const question = room.questions.find((item) => item.id === questionId);
    if (!question) {
      socket.emit('roundError', 'Impossible de récupérer la question.');
      return;
    }

    const headsForRound = shuffle(getPublicHeads(room));
    const headIds = headsForRound.map((head) => head.id);

    room.roundNumber += 1;
    room.currentRound = {
      question: question.text,
      headIds,
      votes: {},
      voters: new Set(),
      status: 'voting',
      revealed: false,
      questionId
    };

    headIds.forEach((id) => {
      room.currentRound.votes[id] = {
        score: 0,
        primary: 0,
        secondary: 0
      };
    });

    room.players.forEach((player) => {
      player.hasVoted = false;
      player.vote = null;
    });

    io.to(roomId).emit('roundStarted', {
      question: room.currentRound.question,
      heads: headsForRound,
      roundNumber: room.roundNumber
    });
  });

  socket.on('castVote', ({ roomId, primaryId, secondaryId }) => {
    const room = rooms.get(roomId);
    if (!room || !room.currentRound || room.currentRound.status !== 'voting') return;

    const player = room.players.get(socket.id);
    if (!player || room.currentRound.voters.has(player.id)) return;
    if (!primaryId || !room.currentRound.headIds.includes(primaryId)) return;

    if (secondaryId) {
      if (!room.currentRound.headIds.includes(secondaryId)) return;
      if (secondaryId === primaryId) return;
    }

    room.currentRound.voters.add(player.id);
    room.currentRound.votes[primaryId].primary += 1;
    room.currentRound.votes[primaryId].score += 1;
    if (secondaryId) {
      room.currentRound.votes[secondaryId].secondary += 1;
      room.currentRound.votes[secondaryId].score += 0.5;
    }
    player.hasVoted = true;
    player.vote = { primaryId, secondaryId: secondaryId || null };

    const totalPlayers = room.players.size;
    if (room.currentRound.voters.size >= totalPlayers) {
      room.currentRound.status = 'reveal';
      io.to(roomId).emit('allVotesIn');
      setTimeout(() => {
        room.currentRound.status = 'finished';
        room.currentRound.revealed = true;
        const results = Object.entries(room.currentRound.votes)
          .map(([id, tally]) => {
            const head = room.heads.find((h) => h.id === id);
            return {
              id,
              count: Number.isInteger(tally.score) ? tally.score : parseFloat(tally.score.toFixed(1)),
              primaryVotes: tally.primary,
              secondaryVotes: tally.secondary,
              name: head ? head.name : 'Inconnu',
              imageUrl: head ? head.imageUrl : ''
            };
          })
          .sort((a, b) => b.count - a.count);
        io.to(roomId).emit('roundResults', {
          results,
          question: room.currentRound.question,
          roundNumber: room.roundNumber
        });
      }, 4200);
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
