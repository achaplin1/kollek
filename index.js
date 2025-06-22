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

/* Slash commands */
const commands = [
  new SlashCommandBuilder().setName('pioche').setDescription('Tire une carte toutes les 2 h'),
  new SlashCommandBuilder().setName('kollek').setDescription('Affiche ta collection'),
  new SlashCommandBuilder().setName('booster').setDescription('Ouvre un booster de 3 cartes')
].map(c => c.toJSON());

client.once('ready', async () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const appId = (await rest.get(Routes.oauth2CurrentApplication())).id;
  await rest.put(Routes.applicationCommands(appId), { body: commands });
  console.log('✅ Commandes enregistrées');

  await pool.query(`CREATE TABLE IF NOT EXISTS pioches (user_id TEXT PRIMARY KEY, last_draw BIGINT);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS collection(user_id TEXT, card_id INTEGER);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS koins (user_id TEXT PRIMARY KEY, amount INTEGER DEFAULT 0);`);
});

const rarityChances = {
  commune:     0.45,
  rare:        0.35,
  épique:      0.19,
  légendaire:  0.01
};
const rarityColors = {
  commune: 0xA0A0A0,
  rare: 0x007BFF,
  épique: 0x9B59B6,
  légendaire: 0xFFD700
};
const rarityKoins = {
  commune: 1,
  rare: 3,
  épique: 7,
  légendaire: 20
};
const boosterCost = 25;

function tirerRareté() {
  const r = Math.random();
  let acc = 0;
  for (const [rarity, chance] of Object.entries(rarityChances)) {
    acc += chance;
    if (r <= acc) return rarity;
  }
  return 'commune';
}

client.on('interactionCreate', async inter => {
  if (!inter.isChatInputCommand()) return;
  const uid = inter.user.id;
  const testUserId = '647838210612920338';

  if (inter.commandName === 'pioche') {
    const now = Date.now();
    const waitTwoH = 2 * 60 * 60 * 1000;
    try {
      await inter.deferReply();
      const { rows } = await pool.query('SELECT last_draw FROM pioches WHERE user_id = $1', [uid]);
      const lastDraw = rows[0]?.last_draw || 0;
      if (uid !== testUserId && now - lastDraw < waitTwoH) {
        const m = Math.ceil((waitTwoH - (now - lastDraw)) / 60000);
        return inter.editReply(`⏳ Attends encore ${m} min pour repiocher.`);
      }

      const rareté = tirerRareté();
      const poolCartes = cartes.filter(c => c.rarity === rareté);
      const carte = poolCartes[Math.floor(Math.random() * poolCartes.length)];

      const { rows: owned } = await pool.query('SELECT 1 FROM collection WHERE user_id = $1 AND card_id = $2', [uid, carte.id]);
      if (owned.length) {
        await pool.query(`INSERT INTO koins(user_id, amount)
          VALUES ($1, $2)
          ON CONFLICT (user_id) DO UPDATE SET amount = koins.amount + $2`, [uid, rarityKoins[rareté]]);
      }
      await pool.query('INSERT INTO collection(user_id, card_id) VALUES ($1, $2)', [uid, carte.id]);
      await pool.query('INSERT INTO pioches(user_id, last_draw) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET last_draw = EXCLUDED.last_draw', [uid, now]);

      const embed = {
        title: '🎴 Carte tirée',
        description: `**${carte.name}**\nRareté : *${carte.rarity}*`,
        color: rarityColors[carte.rarity] ?? 0xffffff
      };
      await inter.editReply({ embeds: [embed], files: [carte.image] });
    } catch (err) {
      console.error(err);
      await inter.editReply('❌ Une erreur est survenue.');
    }
  }

  if (inter.commandName === 'kollek') {
    try {
      await inter.deferReply();
      const { rows } = await pool.query('SELECT card_id FROM collection WHERE user_id = $1', [uid]);
      if (!rows.length) return inter.editReply('😢 Tu ne possèdes encore aucune carte.');

      const countMap = {};
      rows.forEach(r => countMap[r.card_id] = (countMap[r.card_id] || 0) + 1);
      const lignes = Object.entries(countMap).map(([id, count]) => {
        const carte = cartes.find(c => c.id == id);
        return `• **${carte.name}** × ${count} (*${carte.rarity}*)`;
      });

      const chunks = lignes.slice(0, 20);
      const embed = {
        title: `📘 Collection de ${inter.user.username}`,
        description: chunks.join('\n'),
        color: 0x3498db
      };
      await inter.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await inter.editReply("❌ Impossible d'afficher la collection.");
    }
  }

  if (inter.commandName === 'booster') {
    try {
      await inter.deferReply();
      const { rows } = await pool.query('SELECT amount FROM koins WHERE user_id = $1', [uid]);
      const currentKoins = rows[0]?.amount || 0;

      if (currentKoins < boosterCost) {
        return inter.editReply(`💸 Il te faut ${boosterCost} koins pour ouvrir un booster. Tu en as ${currentKoins}.`);
      }

      await pool.query('UPDATE koins SET amount = amount - $2 WHERE user_id = $1', [uid, boosterCost]);

      await inter.editReply(`📦 Tu ouvres un booster...`);

      for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, 1000)); // pause 1s

        const rareté = tirerRareté();
        const poolCartes = cartes.filter(c => c.rarity === rareté);
        const carte = poolCartes[Math.floor(Math.random() * poolCartes.length)];

        await pool.query('INSERT INTO collection(user_id, card_id) VALUES ($1, $2)', [uid, carte.id]);

        const embed = {
          title: `🎴 Carte ${i + 1} tirée`,
          description: `**${carte.name}**\nRareté : *${carte.rarity}*`,
          color: rarityColors[carte.rarity] ?? 0xffffff
        };

        await inter.followUp({ embeds: [embed], files: [carte.image] });
      }
    } catch (err) {
      console.error(err);
      await inter.editReply("❌ Une erreur est survenue pendant l'ouverture du booster.");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
