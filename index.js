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
  new SlashCommandBuilder().setName('booster').setDescription('Ouvre un booster de 3 cartes')
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
});

// ────────────────────────── INTERACTIONS ──────────────────────────
client.on('interactionCreate', async inter => {
  if (!inter.isChatInputCommand()) return;
  const uid = inter.user.id;

  if (inter.commandName === 'pioche') {
    const now = Date.now();
    const waitTwoH = 90 * 60 * 1000;
    try {
      await inter.deferReply();
      const { rows } = await pool.query('SELECT last_draw FROM pioches WHERE user_id = $1', [uid]);
      const lastDraw = rows[0]?.last_draw || 0;
if (now - lastDraw < waitTwoH) {
  const m = Math.ceil((waitTwoH - (now - lastDraw)) / 60000);
  return inter.editReply(`⏳ Attends encore ${m} min pour repiocher.`);
}


      const rareté = tirerRareté();
      const poolCartes = cartes.filter(c => c.rarity === rareté);
      const carte = poolCartes[Math.floor(Math.random() * poolCartes.length)];

      const { rows: owned } = await pool.query('SELECT 1 FROM collection WHERE user_id = $1 AND card_id = $2', [uid, carte.id]);
      let bonusMsg = '';
      if (owned.length) {
  const gain = rarityKoins[rareté];
  await pool.query(`INSERT INTO koins ...`);
  const reaction = rarityReactions[rareté][Math.floor(Math.random() * 4)];
  bonusMsg = `${reaction}\n💰 Carte en double ! Tu gagnes ${gain} koins.`;
} else {
  bonusMsg = rarityReactions[rareté][Math.floor(Math.random() * 4)];
}


      await pool.query('INSERT INTO collection(user_id, card_id) VALUES ($1, $2)', [uid, carte.id]);
      await pool.query('INSERT INTO pioches(user_id, last_draw) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET last_draw = EXCLUDED.last_draw', [uid, now]);

      const embed = {
        title: `${rarityEmojis[carte.rarity]} ${carte.name}`,
        description: `${bonusMsg}\nRareté : *${carte.rarity}*`,
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
      const { rows: collectionRows } = await pool.query('SELECT card_id FROM collection WHERE user_id = $1', [uid]);
      if (!collectionRows.length) return inter.editReply('😢 Tu ne possèdes encore aucune carte.');

      const { rows: koinsRows } = await pool.query('SELECT amount FROM koins WHERE user_id = $1', [uid]);
      const koins = koinsRows[0]?.amount || 0;

      const countMap = {};
      collectionRows.forEach(r => countMap[r.card_id] = (countMap[r.card_id] || 0) + 1);
      const lignes = Object.entries(countMap).map(([id, count]) => {
        const carte = cartes.find(c => c.id == id);
        return `• **${carte.name}** × ${count} (*${carte.rarity}*)`;
      });

      const total = collectionRows.length;
      const uniques = Object.keys(countMap).length;

      const pages = [];
      for (let i = 0; i < lignes.length; i += 10) {
        const desc = lignes.slice(i, i + 10).join('\n') + `\n\n📊 Tu possèdes ${total} cartes dont ${uniques} différentes.\n💰 Koins : ${koins}`;
        pages.push({
          title: `📘 Collection de ${inter.user.username} (page ${Math.floor(i/10)+1}/${Math.ceil(lignes.length/10)})`,
          description: desc,
          color: 0x3498db
        });
      }

      let page = 0;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('◀️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('next').setLabel('▶️').setStyle(ButtonStyle.Secondary)
      );

      const msg = await inter.editReply({ embeds: [pages[page]], components: lignes.length > 10 ? [row] : [] });

      const collector = msg.createMessageComponentCollector({ time: 60000 });
      collector.on('collect', async i => {
        if (i.user.id !== uid) return i.reply({ content: "Pas ton menu !", ephemeral: true });
        if (i.customId === 'next') page = (page + 1) % pages.length;
        if (i.customId === 'prev') page = (page - 1 + pages.length) % pages.length;
        await i.update({ embeds: [pages[page]] });
      });

    } catch (err) {
      console.error(err);
      await inter.editReply("❌ Impossible d'afficher la collection.");
    }
  }

  if (inter.commandName === 'aide') {
  const embed = {
    title: '📖 Aide du jeu de cartes Kollek',
    description: `Bienvenue dans **Kollek**, le jeu de collection de cartes unique avec Nounou !\nVoici tout ce que tu dois savoir 👇`,
    fields: [
      {
        name: '🎴 /pioche',
        value: `Tire **1 carte toutes les 90 minutes**.\nSi c’est un doublon, tu gagnes des **koins** selon sa rareté.`
      },
      {
        name: '📦 /booster',
        value: `Ouvre un booster de **3 cartes** pour **10 koins**.`
      },
      {
        name: '📘 /kollek',
        value: `Affiche ta **collection** de cartes.\nTu vois aussi ton total de cartes et de koins.`
      },
      {
        name: '⭐ Les raretés',
        value: `• ⚪ Commune : 50%\n• 🔵 Rare : 32%\n• 🟣 Épique : 17%\n• 🟡 Légendaire : 1%`
      },
      {
        name: '💰 Les koins',
        value: `Tu gagnes des koins en tirant des **doublons** !\n• Commune : +1\n• Rare : +3\n• Épique : +7\n• Légendaire : +20`
      },
      {
        name: '❓ Autres infos',
        value: `De nouvelles cartes sont ajoutées régulièrement.\nPrépare ta meilleure collection !`
      }
    ],
    color: 0x2ecc71
  };
  return inter.reply({ embeds: [embed], ephemeral: true });
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
        await new Promise(r => setTimeout(r, 1000));
        const rareté = tirerRareté();
        const poolCartes = cartes.filter(c => c.rarity === rareté);
        const carte = poolCartes[Math.floor(Math.random() * poolCartes.length)];

        await pool.query('INSERT INTO collection(user_id, card_id) VALUES ($1,$2)', [uid, carte.id]);

        const reaction = rarityReactions[rareté][Math.floor(Math.random() * 4)];
        const embed = {
          title: `${rarityEmojis[carte.rarity]} Carte ${i + 1}`,
          description: `**${carte.name}**\n${reaction}\nRareté : *${carte.rarity}*`,
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
