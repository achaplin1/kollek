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
const WAVE_CARDS_PRESET_PATH = path.join(DATA_DIR, 'wavelength.json');

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

const DEFAULT_WAVE_CARDS = [
  {
    left: 'Sucré',
    right: 'Salé'
  },
  {
    left: 'Introverti',
    right: 'Extraverti'
  },
  {
    left: 'Science-fiction',
    right: 'Romance'
  }
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
let waveCardPresets = readPreset(WAVE_CARDS_PRESET_PATH, DEFAULT_WAVE_CARDS);

headPresets = sanitizeHeadPresets(headPresets);
questionPresets = sanitizeQuestionPresets(questionPresets);
waveCardPresets = sanitizeWaveCardPresets(waveCardPresets);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

function createRoom(adminName) {
  const roomId = nanoid(6).toUpperCase();
  const adminToken = nanoid(16);
  rooms.set(roomId, {
    adminToken,
    adminName,
    selectedGame: null,
    heads: [],
    questions: [],
    players: new Map(),
    currentRound: null,
    questionDeck: [],
    usedQuestionIds: new Set(),
    roundNumber: 0,
    createdAt: Date.now(),
    wave: {
      cards: [],
      deck: [],
      usedCardIds: new Set(),
      currentRound: null,
      scores: new Map()
    }
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

function sanitizeWaveCardPresets(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const left = typeof entry.left === 'string' ? entry.left.trim() : '';
      const right = typeof entry.right === 'string' ? entry.right.trim() : '';
      if (!left || !right) return null;
      return { left, right };
    })
    .filter(Boolean);
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

function ensureWaveTracking(room) {
  if (!room.wave) {
    room.wave = {
      cards: [],
      deck: [],
      usedCardIds: new Set(),
      currentRound: null,
      scores: new Map()
    };
  }
  if (!(room.wave.usedCardIds instanceof Set)) {
    room.wave.usedCardIds = new Set(
      Array.isArray(room.wave.usedCardIds) ? room.wave.usedCardIds : []
    );
  }
  if (!Array.isArray(room.wave.deck)) {
    room.wave.deck = [];
  }
  if (!(room.wave.scores instanceof Map)) {
    const entries = Array.isArray(room.wave.scores)
      ? room.wave.scores
      : Object.entries(room.wave.scores || {});
    room.wave.scores = new Map(entries);
  }
}

function rebuildWaveDeck(room, { resetUsed = false } = {}) {
  ensureWaveTracking(room);
  if (resetUsed) {
    room.wave.usedCardIds = new Set();
  }
  const availableIds = room.wave.cards
    .map((card) => card.id)
    .filter((id) => !room.wave.usedCardIds.has(id));
  room.wave.deck = shuffle(availableIds);
}

function drawWaveCard(room) {
  ensureWaveTracking(room);
  let availableCardIds = room.wave.cards
    .map((card) => card.id)
    .filter((id) => !room.wave.usedCardIds.has(id));

  room.wave.deck = (room.wave.deck || []).filter((id) => availableCardIds.includes(id));

  if (room.wave.deck.length === 0) {
    if (availableCardIds.length === 0) {
      room.wave.usedCardIds = new Set();
      availableCardIds = room.wave.cards.map((card) => card.id);
    }
    room.wave.deck = shuffle(availableCardIds);
  }

  if (room.wave.deck.length === 0) {
    return null;
  }

  const cardId = room.wave.deck.pop();
  room.wave.usedCardIds.add(cardId);
  const card = room.wave.cards.find((item) => item.id === cardId);
  if (!card) {
    return null;
  }

  return { card, cardId };
}

function drawNextQuestion(room) {
  ensureQuestionTracking(room);
  const availableQuestionIds = room.questions
    .map((question) => question.id)
    .filter((id) => !room.usedQuestionIds.has(id));

  room.questionDeck = (room.questionDeck || []).filter((id) => availableQuestionIds.includes(id));

  if (room.questionDeck.length === 0) {
    room.questionDeck = shuffle(availableQuestionIds);
  }

  if (room.questionDeck.length === 0) {
    return null;
  }

  const questionId = room.questionDeck.pop();
  room.usedQuestionIds.add(questionId);
  const question = room.questions.find((item) => item.id === questionId);
  if (!question) {
    return null;
  }

  return { question, questionId };
}

function launchRound(room, { reuseNumber = false } = {}) {
  if (!Array.isArray(room.heads) || room.heads.length === 0) {
    return { error: 'Ajoute au moins une tête et une question.' };
  }
  if (!Array.isArray(room.questions) || room.questions.length === 0) {
    return { error: 'Ajoute au moins une tête et une question.' };
  }

  const draw = drawNextQuestion(room);
  if (!draw) {
    return { error: 'Plus de questions disponibles. Ajoute-en pour continuer !' };
  }

  const headsForRound = shuffle(getPublicHeads(room));
  if (!headsForRound.length) {
    return { error: 'Ajoute au moins une tête et une question.' };
  }

  const headIds = headsForRound.map((head) => head.id);

  if (!reuseNumber) {
    room.roundNumber += 1;
  } else if (room.roundNumber === 0) {
    room.roundNumber = 1;
  }

  room.currentRound = {
    question: draw.question.text,
    headIds,
    votes: {},
    voters: new Set(),
    status: 'voting',
    revealed: false,
    questionId: draw.questionId
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

  return {
    question: room.currentRound.question,
    heads: headsForRound,
    roundNumber: room.roundNumber
  };
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

function roomWaveCardsFromPresets(raw) {
  return sanitizeWaveCardPresets(raw).map((card) => ({
    id: nanoid(8),
    left: card.left,
    right: card.right
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

function serializeWaveScores(room) {
  ensureWaveTracking(room);
  return Array.from(room.wave.scores.entries()).map(([playerId, score]) => ({
    playerId,
    score
  }));
}

function serializeWaveRound(room, viewerId = null) {
  ensureWaveTracking(room);
  const round = room.wave.currentRound;
  if (!round) return null;
  const isClueGiver = viewerId && round.clueGiverId === viewerId;
  return {
    id: round.id,
    status: round.status,
    clueGiverId: round.clueGiverId,
    card: round.card
      ? { left: round.card.left, right: round.card.right }
      : null,
    hint: round.hint,
    guesses:
      round.status === 'revealed' || round.status === 'locked'
        ? Object.entries(round.guesses || {}).map(([playerId, value]) => ({
            playerId,
            value
          }))
        : [],
    target:
      isClueGiver || round.status === 'revealed'
        ? {
            center: round.target ? round.target.center : null,
            start: round.target ? round.target.start : null,
            end: round.target ? round.target.end : null
          }
        : null,
    roundNumber: round.roundNumber || 0
  };
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
  res.json({ heads: headPresets, questions: questionPresets, waveCards: waveCardPresets });
});

app.post('/api/presets', (req, res) => {
  const token = req.headers['x-admin-token'];
  const match = findRoomByToken(token);
  if (!match) {
    return res.status(403).json({ error: 'Non autorisé.' });
  }
  const headsInput = Array.isArray(req.body.heads) ? req.body.heads : headPresets;
  const questionsInput = Array.isArray(req.body.questions) ? req.body.questions : questionPresets;
  const waveCardsInput = Array.isArray(req.body.waveCards) ? req.body.waveCards : waveCardPresets;
  headPresets = sanitizeHeadPresets(headsInput);
  questionPresets = sanitizeQuestionPresets(questionsInput);
  waveCardPresets = sanitizeWaveCardPresets(waveCardsInput);
  writePreset(HEADS_PRESET_PATH, headPresets);
  writePreset(QUESTIONS_PRESET_PATH, questionPresets);
  writePreset(WAVE_CARDS_PRESET_PATH, waveCardPresets);
  res.json({ heads: headPresets, questions: questionPresets, waveCards: waveCardPresets });
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

    ensureWaveTracking(room);
    if (!room.wave.scores.has(socket.id)) {
      room.wave.scores.set(socket.id, 0);
    }

    socket.join(roomId);
    socket.data = { roomId, name, isAdmin };

    const payload = {
      roomId,
      name,
      isAdmin,
      selfId: socket.id,
      gameType: room.selectedGame,
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
        : null,
      waveState: serializeWaveRound(room, socket.id),
      waveScores: serializeWaveScores(room)
    };

    socket.emit('joined', payload);

    io.to(roomId).emit('playersUpdated', Array.from(room.players.values()).map(({ id, name: playerName, isAdmin: admin }) => ({
      id,
      name: playerName,
      isAdmin: admin
    })));
    io.to(roomId).emit('waveScoresUpdated', serializeWaveScores(room));
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

  socket.on('replaceWaveCards', ({ roomId, adminToken, cards }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminToken !== adminToken) return;
    ensureWaveTracking(room);
    const normalized = roomWaveCardsFromPresets(Array.isArray(cards) ? cards : []);
    room.wave.cards = normalized;
    rebuildWaveDeck(room, { resetUsed: true });
    room.wave.currentRound = null;
    io.to(roomId).emit('waveCardsUpdated');
  });

  socket.on('selectGame', ({ roomId, adminToken, gameType }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminToken !== adminToken) return;
    if (!['qui', 'wavelength'].includes(gameType)) return;

    room.selectedGame = gameType;

    if (gameType === 'qui') {
      room.heads = roomHeadsFromPresets(headPresets);
      room.questions = roomQuestionsFromPresets(questionPresets);
      rebuildQuestionDeck(room, { resetUsed: true });
      room.currentRound = null;
      room.roundNumber = 0;
      ensureWaveTracking(room);
      room.wave.currentRound = null;
    } else if (gameType === 'wavelength') {
      ensureWaveTracking(room);
      room.wave.cards = roomWaveCardsFromPresets(waveCardPresets);
      rebuildWaveDeck(room, { resetUsed: true });
      room.wave.currentRound = null;
      room.wave.scores = new Map();
      room.players.forEach((player) => {
        room.wave.scores.set(player.id, 0);
      });
      room.currentRound = null;
      room.roundNumber = 0;
    }

    room.players.forEach((player) => {
      player.hasVoted = false;
      player.vote = null;
    });

    io.to(roomId).emit('gameSelected', {
      gameType,
      heads: getPublicHeads(room),
      questions: getPublicQuestions(room),
      waveState: serializeWaveRound(room),
      waveScores: serializeWaveScores(room)
    });
  });

  socket.on('startRound', ({ roomId, adminToken }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminToken !== adminToken) return;
    if (room.selectedGame !== 'qui') return;

    if (room.currentRound && room.currentRound.status !== 'finished') {
      socket.emit('roundError', 'Une manche est déjà en cours.');
      return;
    }

    if (room.currentRound && room.currentRound.status === 'finished') {
      room.currentRound = null;
    }

    if (room.players.size === 0) {
      socket.emit('roundError', 'Attends qu\'au moins un joueur soit connecté.');
      return;
    }

    const result = launchRound(room, { reuseNumber: false });
    if (result.error) {
      socket.emit('roundError', result.error);
      return;
    }

    io.to(roomId).emit('roundStarted', {
      question: result.question,
      heads: result.heads,
      roundNumber: result.roundNumber
    });
  });

  socket.on('skipQuestion', ({ roomId, adminToken }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminToken !== adminToken) return;
    if (room.selectedGame !== 'qui') return;

    if (!room.currentRound || room.currentRound.status !== 'voting') {
      socket.emit('roundError', 'Impossible de passer cette question pour le moment.');
      return;
    }

    if (room.currentRound.voters && room.currentRound.voters.size > 0) {
      socket.emit('roundError', 'Trop tard pour zapper : des votes sont déjà enregistrés.');
      return;
    }

    const result = launchRound(room, { reuseNumber: true });
    if (result.error) {
      socket.emit('roundError', result.error);
      return;
    }

    io.to(roomId).emit('roundStarted', {
      question: result.question,
      heads: result.heads,
      roundNumber: result.roundNumber
    });
  });

  socket.on('castVote', ({ roomId, primaryId, secondaryId }) => {
    const room = rooms.get(roomId);
    if (!room || room.selectedGame !== 'qui') return;
    if (!room.currentRound || room.currentRound.status !== 'voting') return;

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
    if (!room || room.adminToken !== adminToken || room.selectedGame !== 'qui' || !room.currentRound) return;
    room.currentRound = null;
    room.players.forEach((player) => {
      player.hasVoted = false;
      player.vote = null;
    });
    io.to(roomId).emit('roundEnded');
  });

  socket.on('startWaveRound', ({ roomId, adminToken, clueGiverId }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminToken !== adminToken) return;
    if (room.selectedGame !== 'wavelength') return;
    ensureWaveTracking(room);

    if (room.wave.currentRound && room.wave.currentRound.status !== 'revealed') {
      socket.emit('waveError', "Une manche est déjà en cours.");
      return;
    }

    if (!clueGiverId || !room.players.has(clueGiverId)) {
      socket.emit('waveError', 'Choisis un joueur valide pour faire deviner.');
      return;
    }

    if (room.players.size < 2) {
      socket.emit('waveError', 'Invite au moins un autre joueur avant de lancer.');
      return;
    }

    const draw = drawWaveCard(room);
    if (!draw) {
      socket.emit('waveError', 'Plus de cartes disponibles. Ajoute des cartes dans le JSON.');
      return;
    }

    const roundNumber = (room.wave.roundCounter || 0) + 1;
    room.wave.roundCounter = roundNumber;
    const center = Math.floor(Math.random() * 101);
    const spread = 14;
    const target = {
      center,
      start: Math.max(0, center - spread),
      end: Math.min(100, center + spread)
    };

    room.wave.currentRound = {
      id: nanoid(10),
      status: 'waitingClue',
      clueGiverId,
      card: draw.card,
      cardId: draw.cardId,
      hint: '',
      guesses: {},
      target,
      roundNumber
    };

    room.players.forEach((player) => {
      player.hasVoted = false;
      player.vote = null;
    });

    const publicCard = { left: draw.card.left, right: draw.card.right };

    io.to(roomId).emit('waveRoundPending', {
      clueGiverId,
      card: publicCard,
      roundNumber
    });

    io.to(clueGiverId).emit('waveClueCard', {
      roundId: room.wave.currentRound.id,
      card: publicCard,
      target,
      roundNumber
    });
  });

  socket.on('submitWaveClue', ({ roomId, roundId, clue }) => {
    const room = rooms.get(roomId);
    if (!room || room.selectedGame !== 'wavelength') return;
    ensureWaveTracking(room);
    const round = room.wave.currentRound;
    if (!round || round.id !== roundId) return;
    if (round.clueGiverId !== socket.id) return;
    if (round.status !== 'waitingClue') return;

    const hint = typeof clue === 'string' ? clue.trim() : '';
    if (!hint) {
      socket.emit('waveError', 'Donne un indice avant de valider.');
      return;
    }

    round.hint = hint;
    round.status = 'guessing';

    io.to(roomId).emit('waveClueShared', {
      roundId: round.id,
      clueGiverId: round.clueGiverId,
      card: { left: round.card.left, right: round.card.right },
      hint,
      roundNumber: round.roundNumber
    });
  });

  socket.on('waveGuess', ({ roomId, roundId, value }) => {
    const room = rooms.get(roomId);
    if (!room || room.selectedGame !== 'wavelength') return;
    ensureWaveTracking(room);
    const round = room.wave.currentRound;
    if (!round || round.id !== roundId) return;
    if (round.status !== 'guessing') return;
    if (socket.id === round.clueGiverId) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    const clamped = Math.max(0, Math.min(100, Math.round(numericValue)));

    if (!round.guesses) {
      round.guesses = {};
    }

    round.guesses[player.id] = clamped;

    const guessers = Array.from(room.players.values()).filter((p) => p.id !== round.clueGiverId);
    const totalGuessers = guessers.length;
    const received = Object.keys(round.guesses).length;

    socket.emit('waveGuessAck', {
      roundId: round.id,
      value: clamped
    });

    if (totalGuessers === 0) {
      socket.emit('waveError', 'Invite au moins un autre joueur pour deviner.');
      return;
    }

    if (received >= totalGuessers) {
      round.status = 'locked';
      const revealPayload = Object.entries(round.guesses).map(([playerId, val]) => ({
        playerId,
        value: val
      }));
      io.to(roomId).emit('waveRevealStart', {
        roundId: round.id,
        guesses: revealPayload,
        card: { left: round.card.left, right: round.card.right },
        hint: round.hint,
        roundNumber: round.roundNumber,
        clueGiverId: round.clueGiverId
      });

      setTimeout(() => {
        const scores = [];
        const results = Object.entries(round.guesses).map(([playerId, val]) => {
          const diff = Math.abs(val - round.target.center);
          let points = 0;
          if (diff <= 5) points = 4;
          else if (diff <= 10) points = 3;
          else if (diff <= 17) points = 2;
          else if (diff <= 25) points = 1;
          scores.push({ playerId, points });
          return { playerId, value: val, diff, points };
        });
        const best = scores.reduce((max, entry) => (entry.points > max ? entry.points : max), 0);
        if (best > 0 && round.clueGiverId) {
          scores.push({ playerId: round.clueGiverId, points: best });
        }
        scores.forEach(({ playerId, points }) => {
          const prev = room.wave.scores.get(playerId) || 0;
          room.wave.scores.set(playerId, prev + points);
        });
        round.status = 'revealed';
        io.to(roomId).emit('waveTargetRevealed', {
          roundId: round.id,
          target: round.target,
          results,
          clueGiverId: round.clueGiverId,
          card: { left: round.card.left, right: round.card.right },
          hint: round.hint,
          roundNumber: round.roundNumber
        });
        io.to(roomId).emit('waveScoresUpdated', serializeWaveScores(room));
      }, 2800);
    } else {
      io.to(roomId).emit('waveWaiting', {
        roundId: round.id,
        received,
        total: totalGuessers
      });
    }
  });

  socket.on('resetWaveRound', ({ roomId, adminToken }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminToken !== adminToken) return;
    if (room.selectedGame !== 'wavelength') return;
    ensureWaveTracking(room);
    room.wave.currentRound = null;
    io.to(roomId).emit('waveRoundCleared');
  });

  socket.on('disconnect', () => {
    const { roomId } = socket.data || {};
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.players.delete(socket.id);

    ensureWaveTracking(room);
    room.wave.scores.delete(socket.id);

    if (room.players.size === 0) {
      rooms.delete(roomId);
      return;
    }

    io.to(roomId).emit('playersUpdated', Array.from(room.players.values()).map(({ id, name, isAdmin }) => ({
      id,
      name,
      isAdmin
    })));
    io.to(roomId).emit('waveScoresUpdated', serializeWaveScores(room));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
