// ────────────────────────── CONFIGURATION ──────────────────────────
require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const { Pool } = require('pg');
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
app.use('/cartes', express.static(path.join(__dirname, 'cartes')));
app.listen(PORT, () => console.log(`✅ Express running on ${PORT}`));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const cartes = JSON.parse(fs.readFileSync('./cartes.json', 'utf8'));

// ────────────────────────── COMMANDES ──────────────────────────
const commands = [
  new SlashCommandBuilder().setName('aide').setDescription("Affiche l'aide du jeu"),
  new SlashCommandBuilder().setName('pioche').setDescription('Tire une carte toutes les 1h30'),
  new SlashCommandBuilder().setName('kollek').setDescription('Affiche ta collection'),
  new SlashCommandBuilder().setName('booster').setDescription('Ouvre un booster de 3 cartes'),
  new SlashCommandBuilder().setName('bonus').setDescription('Réclame ton bonus de koins quotidien')
].map(c => c.toJSON());

// ────────────────────────── RARETÉ ──────────────────────────
const rarityChances = {
  commune: 0.499,
  rare: 0.32,
  épique: 0.171,
  légendaire: 0.01
};
const rarityColors = { commune: 0xA0A0A0, rare: 0x007BFF, épique: 0x9B59B6, légendaire: 0xFFD700 };
const rarityKoins = { commune: 1, rare: 3, épique: 7, légendaire: 20 };
const rarityEmojis = { commune: '⚪', rare: '🔵', épique: '🟣', légendaire: '🟡' };
const rarityReactions = {
  commune: ['Pas ouf !', 'Encore elle...', 'Mouais.', 'Bof bof.'],
  rare: ['Pas mal !', 'Stylé !', 'Bonne pioche !', 'Je la voulais.'],
  épique: ['Wouah !', 'Trop classe !', 'Incroyable tirage !', 'Magnifique !'],
  légendaire: ['LÉGENDAIRE !!!!', 'LA CARTE ULTIME !', 'C’est un MIRACLE !', 'Tu forces le destin !']
};
const boosterCost = 10;

function tirerRareté() {
  const r = Math.random();
  let acc = 0;
  for (const [rarity, chance] of Object.entries(rarityChances)) {
    acc += chance;
    if (r <= acc) return rarity;
  }
  return 'commune';
}

// ────────────────────────── READY ──────────────────────────
client.once('ready', async () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const appId = (await rest.get(Routes.oauth2CurrentApplication())).id;
  await rest.put(Routes.applicationCommands(appId), { body: commands });
  console.log('✅ Commandes enregistrées');

  await pool.query(`CREATE TABLE IF NOT EXISTS pioches (user_id TEXT PRIMARY KEY, last_draw BIGINT);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS collection(user_id TEXT, card_id INTEGER);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS koins (user_id TEXT PRIMARY KEY, amount INTEGER DEFAULT 0);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS bonus (user_id TEXT PRIMARY KEY, last_claim BIGINT);`);
});

// ────────────────────────── INTERACTIONS ──────────────────────────
client.on('interactionCreate', async inter => {
  if (!inter.isChatInputCommand()) return;
  const uid = inter.user.id;

  if (inter.commandName === 'bonus') {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    try {
      const { rows } = await pool.query('SELECT last_claim FROM bonus WHERE user_id = $1', [uid]);
      const last = rows[0]?.last_claim || 0;
      if (now - last < oneDay) {
        const h = Math.ceil((oneDay - (now - last)) / 3600000);
        return inter.reply({ content: `⏳ Reviens dans ${h}h pour réclamer ton prochain bonus.`, ephemeral: true });
      }
      const amount = 5;
      await pool.query(`INSERT INTO koins(user_id, amount) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET amount = koins.amount + $2`, [uid, amount]);
      await pool.query(`INSERT INTO bonus(user_id, last_claim) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET last_claim = EXCLUDED.last_claim`, [uid, now]);
      await inter.reply({ content: `🎁 Tu as reçu **${amount} koins** de bonus quotidien !`, ephemeral: true });
    } catch (err) {
      console.error(err);
      await inter.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
    }
  }

  // (le reste de tes commandes existantes ici)
});

client.login(process.env.DISCORD_TOKEN);
