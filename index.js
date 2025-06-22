require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { Pool } = require('pg');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const cartes = JSON.parse(fs.readFileSync('./cartes.json', 'utf8'));

const commands = [
  new SlashCommandBuilder()
    .setName('pioche')
    .setDescription('Tire une carte toutes les 2 heures')
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const appId = (await rest.get(Routes.oauth2CurrentApplication())).id;
  await rest.put(Routes.applicationCommands(appId), { body: commands });
  console.log('Commandes enregistrées.');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pioches (
      user_id TEXT PRIMARY KEY,
      last_draw BIGINT
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS collection (
      user_id TEXT,
      card_id INTEGER
    );
  `);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'pioche') return;

  const userId = interaction.user.id;
  const now = Date.now();
  const deuxHeures = 2 * 60 * 60 * 1000;

  try {
    const res = await pool.query('SELECT last_draw FROM pioches WHERE user_id = $1', [userId]);
    const lastDraw = res.rows[0]?.last_draw || 0;
    const diff = now - lastDraw;

    if (diff < deuxHeures) {
      const minutesRestantes = Math.ceil((deuxHeures - diff) / (60 * 1000));
      await interaction.reply({ content: `⏳ Tu dois encore attendre ${minutesRestantes} min avant de repiocher.`, ephemeral: true });
    } else {
      const carte = cartes[Math.floor(Math.random() * cartes.length)];
      await pool.query('INSERT INTO collection (user_id, card_id) VALUES ($1, $2)', [userId, carte.id]);
      await pool.query('INSERT INTO pioches (user_id, last_draw) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET last_draw = EXCLUDED.last_draw', [userId, now]);
      await interaction.reply({ content: `🎴 Tu as tiré : **${carte.name}** (${carte.rarity})`, files: [carte.image] });
    }
  } catch (err) {
    console.error(err);
    interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
