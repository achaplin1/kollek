const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const rarityChances = {
  "commune": 0.7,
  "rare": 0.2,
  "épique": 0.08,
  "légendaire": 0.02
};

const allCards = [
  { "id": 1, "name": "Dragon Bleu", "rarity": "légendaire" },
  { "id": 2, "name": "Rat Géant", "rarity": "commune" },
  { "id": 3, "name": "Mage des Ténèbres", "rarity": "épique" },
  { "id": 4, "name": "Soldat", "rarity": "commune" },
  { "id": 5, "name": "Gobelin", "rarity": "commune" },
  { "id": 6, "name": "Archer Elfique", "rarity": "rare" },
  { "id": 7, "name": "Golem de Fer", "rarity": "rare" },
  { "id": 8, "name": "Phoenix", "rarity": "épique" }
];

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

app.post('/api/login', async (req, res) => {
  const { userId, username } = req.body;
  console.log('Connexion:', userId, username);

  try {
    const existing = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);

    if (existing.rowCount === 0) {
      console.log('Nouvel utilisateur, insertion...');
      await pool.query(
        'INSERT INTO users (id, username, cards) VALUES ($1, $2, $3)',
        [userId, username, JSON.stringify([])]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Erreur login:', err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/open-booster', async (req, res) => {
  const { userId } = req.body;
  const booster = Array.from({ length: 5 }, getRandomCard);

  try {
    const result = await pool.query('SELECT cards FROM users WHERE id = $1', [userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const currentCards = Array.isArray(result.rows[0].cards) ? result.rows[0].cards : [];
    const updatedCards = [...currentCards, ...booster];

    await pool.query('UPDATE users SET cards = $1 WHERE id = $2', [
      JSON.stringify(updatedCards),
      userId
    ]);

    res.json(booster);
  } catch (err) {
    console.error('Erreur booster:', err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/inventory/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query('SELECT cards FROM users WHERE id = $1', [userId]);

    if (result.rowCount === 0) {
      return res.json([]);
    }

    const cards = result.rows[0].cards;
    if (!Array.isArray(cards)) return res.json([]);

    res.json(cards);
  } catch (err) {
    console.error('Erreur inventaire:', err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.listen(PORT, () => console.log(`Serveur PostgreSQL sur http://localhost:${PORT}`));
