require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { Pool } = require('pg');
const express = require('express');
const path = require('path');
const fs = require('fs');

/* ─────────────────────────  EXPRESS  ───────────────────────── */
const app = express();
const PORT = process.env.PORT || 3000;
app.use('/cartes', express.static(path.join(__dirname, 'cartes')));
app.listen(PORT, () => console.log(`✅ Express running on ${PORT}`));

/* ─────────────────────────  DISCORD  ───────────────────────── */
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const pool   = new Pool({ connectionString: process.env.DATABASE_URL });
const cartes = JSON.parse(fs.readFileSync('./cartes.json', 'utf8'));

/* Slash command */
const commands = [
  new SlashCommandBuilder().setName('pioche').setDescription('Tire une carte toutes les 2 h')
].map(c => c.toJSON());

client.once('ready', async () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const appId = (await rest.get(Routes.oauth2CurrentApplication())).id;
  await rest.put(Routes.applicationCommands(appId), { body: commands });
  console.log('✅ Commandes enregistrées');

  /* Tables */
  await pool.query(`CREATE TABLE IF NOT EXISTS pioches   (user_id TEXT PRIMARY KEY, last_draw BIGINT);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS collection(user_id TEXT, card_id  INTEGER);`);
});

/* ─────────────────────  LOGIQUE DE PIOCHE  ─────────────────── */
const rarityChances = {        // 55 % / 35 % / 9 % / 1 %
  commune:     0.55,
  rare:        0.35,
  épique:      0.09,
  légendaire:  0.01
};

function tirerRareté() {
  const r = Math.random();
  let acc = 0;
  for (const [rarity, chance] of Object.entries(rarityChances)) {
    acc += chance;
    if (r <= acc) return rarity;
  }
  return 'commune';           // fallback (théoriquement inutile)
}

const rarityColors = {
  commune:     0xA0A0A0,
  rare:        0x007BFF,
  épique:      0x9B59B6,
  légendaire:  0xFFD700
};

/* ─────────────────────  INTERACTION SLASH  ─────────────────── */
client.on('interactionCreate', async inter => {
  if (!inter.isChatInputCommand() || inter.commandName !== 'pioche') return;

  const uid        = inter.user.id;
  const now        = Date.now();
  const waitTwoH   = 2 * 60 * 60 * 1000;
  const testUserId = '647838210612920338';

  try {
    await inter.deferReply();

    /* Cool-down */
    const { rows } = await pool.query('SELECT last_draw FROM pioches WHERE user_id = $1', [uid]);
    const lastDraw = rows[0]?.last_draw || 0;
    if (uid !== testUserId && now - lastDraw < waitTwoH) {
      const m = Math.ceil((waitTwoH - (now - lastDraw)) / 60000);
      return inter.editReply(`⏳ Attends encore ${m} min pour repiocher.`);
    }

    /* Tirage */
    const rareté = tirerRareté();
    const poolCartes = cartes.filter(c => c.rarity === rareté);
    const carte = poolCartes[Math.floor(Math.random() * poolCartes.length)];

    /* Stockage */
    await pool.query('INSERT INTO collection(user_id, card_id) VALUES ($1,$2)', [uid, carte.id]);
    await pool.query(
      'INSERT INTO pioches(user_id, last_draw) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET last_draw = EXCLUDED.last_draw',
      [uid, now]
    );

    /* Embed + image jointe grande */
    const embed = {
      title: '🎴 Carte tirée',
      description: `**${carte.name}**\nRareté : *${carte.rarity}*`,
      color: rarityColors[carte.rarity] ?? 0xffffff
    };

    await inter.editReply({ embeds: [embed], files: [carte.image] });

  } catch (err) {
    console.error('❌ Erreur pioche :', err);
    await inter.editReply('❌ Une erreur est survenue.');
  }
});

client.login(process.env.DISCORD_TOKEN);
