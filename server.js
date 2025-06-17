const express = require('express');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

const path = require('path');
const dbPath = path.join(__dirname, 'db.json');
const cardsPath = path.join(__dirname, 'cards.json');

// Charger les cartes
const allCards = JSON.parse(fs.readFileSync(cardsPath));

// Rareté des cartes
const rarityChances = {
  "commune": 0.7,
  "rare": 0.2,
  "épique": 0.08,
  "légendaire": 0.02
};

function getRandomCard() {
  const rand = Math.random();
  let cumulative = 0;
  for (const rarity in rarityChances) {
    cumulative += rarityChances[rarity];
    if (rand <= cumulative) {
      const filtered = allCards.filter(c => c.rarity === rarity);
      return filtered[Math.floor(Math.random() * filtered.length)];
    }
  }
  return allCards[0];
}

function loadDb() {
  return JSON.parse(fs.readFileSync(dbPath));
}

function saveDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

app.post('/api/open-booster', (req, res) => {
  const { userId } = req.body;
  const db = loadDb();
  if (!db[userId]) db[userId] = [];

  const booster = Array.from({ length: 5 }, getRandomCard);
  db[userId].push(...booster);
  saveDb(db);

  res.json(booster);
});

app.post('/api/login', (req, res) => {
  const { userId } = req.body;
  const db = loadDb();
  if (!db[userId]) db[userId] = [];
  saveDb(db);
  res.json({ success: true });
});

app.get('/api/inventory/:userId', (req, res) => {
  const db = loadDb();
  res.json(db[req.params.userId] || []);
});

app.listen(PORT, () => console.log(`Serveur sur http://localhost:${PORT}`));
