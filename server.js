// server.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' }
});

const sampleQuestions = [
  "Qui adore les chats ?",
  "Qui choisirait toujours du bleu ?",
  "Qui pourrait jouer dans un film d'action ?",
];

const rooms = {};

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ room, name }) => {
    socket.join(room);

    if (!rooms[room]) {
      rooms[room] = { players: [], answers: {}, index: 0 };
    }

    const roomData = rooms[room];

    if (!roomData.players.includes(name)) {
      roomData.players.push(name);
    }

    io.to(room).emit('updatePlayers', roomData.players);
  });

  socket.on('startGame', (room) => {
    const roomData = rooms[room];
    if (!roomData) return;
    roomData.index = 0;
    roomData.answers = {};
    io.to(room).emit('nextQuestion', roomData.index);
  });

  socket.on('answer', ({ room, questionIndex, player }) => {
    const roomData = rooms[room];
    if (!roomData) return;

    if (!roomData.answers[questionIndex]) {
      roomData.answers[questionIndex] = [];
    }

    roomData.answers[questionIndex].push(player);

    const allAnswered = roomData.answers[questionIndex].length === roomData.players.length;

    if (allAnswered) {
      roomData.index++;
      if (roomData.index < sampleQuestions.length) {
        io.to(room).emit('nextQuestion', roomData.index);
      } else {
        io.to(room).emit('gameOver', roomData.answers);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Serveur lancé sur le port ${PORT}`);
});
