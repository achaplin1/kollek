require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const db = new sqlite3.Database('./database.db');
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

  db.run("CREATE TABLE IF NOT EXISTS pioches (user_id TEXT, last_draw INTEGER)");
  db.run("CREATE TABLE IF NOT EXISTS collection (user_id TEXT, card_id INTEGER)");
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'pioche') return;

  const userId = interaction.user.id;
  const now = Date.now();
  const deuxHeures = 2 * 60 * 60 * 1000;

  db.get('SELECT last_draw FROM pioches WHERE user_id = ?', [userId], (err, row) => {
    const lastDraw = row?.last_draw || 0;
    const diff = now - lastDraw;

    if (diff < deuxHeures) {
      const minutesRestantes = Math.ceil((deuxHeures - diff) / (60 * 1000));
      interaction.reply({ content: `⏳ Tu dois encore attendre ${minutesRestantes} min avant de repiocher.`, ephemeral: true });
    } else {
      const carte = cartes[Math.floor(Math.random() * cartes.length)];
      db.run('INSERT INTO collection (user_id, card_id) VALUES (?, ?)', [userId, carte.id]);
      db.run('INSERT OR REPLACE INTO pioches (user_id, last_draw) VALUES (?, ?)', [userId, now]);
      interaction.reply({ content: `🎴 Tu as tiré : **${carte.name}** (${carte.rarity})`, files: [carte.image] });
    }
  });
});

client.login(process.env.DISCORD_TOKEN);
