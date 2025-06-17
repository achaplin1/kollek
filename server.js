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

const rooms = {};

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ room, name }) => {
    socket.join(room);
    if (!rooms[room]) rooms[room] = { players: [], answers: {}, index: 0 };
    if (!rooms[room].players.includes(name)) rooms[room].players.push(name);
    io.to(room).emit('updatePlayers', rooms[room].players);
  });

  socket.on('startGame', (room) => {
    rooms[room].index = 0;
    io.to(room).emit('nextQuestion', rooms[room].index);
  });

  socket.on('answer', ({ room, questionIndex, player }) => {
    const q = questionIndex;
    if (!rooms[room].answers[q]) rooms[room].answers[q] = [];
    rooms[room].answers[q].push(player);
    // Quand tout le monde a répondu, on passe à la suite
    if (rooms[room].answers[q].length === rooms[room].players.length) {
      rooms[room].index++;
      if (rooms[room].index < sampleQuestions.length) {
        io.to(room).emit('nextQuestion', rooms[room].index);
      } else {
        io.to(room).emit('gameOver', rooms[room].answers);
      }
    }
  });
});

const sampleQuestions = [
  "Qui adore les chats ?",
  "Qui choisirait toujours du bleu ?",
  "Qui pourrait jouer dans un film d'action ?"
];

server.listen(3001, () => {
  console.log('Server running on port 3001');
});
