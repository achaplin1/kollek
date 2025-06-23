// ────────────────────────── CONFIGURATION ──────────────────────────
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const express = require('express');
const { Pool } = require('pg');
const path   = require('path');
const fs     = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;
app.use('/cartes', express.static(path.join(__dirname, 'cartes')));
app.listen(PORT, () => console.log(`✅ Express (static) sur ${PORT}`));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const pool   = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const cartes = JSON.parse(fs.readFileSync('./cartes.json', 'utf8'));

// ────────────────────────── SLASH COMMANDS ──────────────────────────
const commands = [
  new SlashCommandBuilder().setName('aide').setDescription("Affiche l'aide du jeu"),
  new SlashCommandBuilder().setName('pioche').setDescription('Tire une carte toutes les 1 h 30'),
  new SlashCommandBuilder().setName('kollek').setDescription('Affiche ta collection'),
  new SlashCommandBuilder().setName('booster').setDescription('Ouvre un booster de 3 cartes (10 koins)'),
  new SlashCommandBuilder().setName('bonus').setDescription('Réclame 5 koins toutes les 24 h'),
  new SlashCommandBuilder().setName('dé').setDescription('Lance un dé toutes les 4 h pour gagner des koins')
].map(c => c.toJSON());

// ────────────────────────── CONSTANTES ──────────────────────────
const rarityChances = { commune: 0.499, rare: 0.32, épique: 0.171, légendaire: 0.01 };
const rarityColors  = { commune: 0xCCCCCC, rare: 0x3498db, épique: 0x9b59b6, légendaire: 0xf1c40f };
const rarityEmojis  = { commune: '⚪',     rare: '🔵',     épique: '🟣',       légendaire: '🟡' };
const rarityKoins   = { commune: 1, rare: 3, épique: 7, légendaire: 20 };
const boosterCost   = 10;
const rarityReactions = {
  commune: [
    "Une carte toute simple",
    "Rien d’extra, mais c’est toujours ça",
    "Basique",
    "Bof"
  ],
  rare: [
    "Pas mal, une rare !",
    "Une trouvaille sympa !",
    "Ça commence à devenir intéressant.",
    "Une carte rare, GG !"
  ],
  épique: [
    "Wow, épique !",
    "Une sacrée carte !",
    "La chance te sourit.",
    "On touche au légendaire… presque."
  ],
  légendaire: [
    "🌟 LÉGENDAIRE !!"
  ]
};

// ────────────────────────── OUTILS ──────────────────────────
function tirerRareté() {
  const r = Math.random();
  let acc = 0;
  for (const [rar, p] of Object.entries(rarityChances)) {
    acc += p;
    if (r <= acc) return rar;
  }
  return 'commune';
}

// ────────────────────────── READY ──────────────────────────
client.once('ready', async () => {
  console.log(`🤖 Connecté : ${client.user.tag}`);

  const rest  = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const appId = (await rest.get(Routes.oauth2CurrentApplication())).id;
  await rest.put(Routes.applicationCommands(appId), { body: commands });
  console.log('✅ Slash commands enregistrées');

  await pool.query(`CREATE TABLE IF NOT EXISTS pioches  (user_id TEXT PRIMARY KEY, last_draw  BIGINT);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS bonus    (user_id TEXT PRIMARY KEY, last_claim BIGINT);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS rolls    (user_id TEXT PRIMARY KEY, last_roll  BIGINT);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS koins    (user_id TEXT PRIMARY KEY, amount     INT    DEFAULT 0);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS collection(user_id TEXT, card_id INT);`);
});

// ────────────────────────── INTERACTIONS ──────────────────────────
client.on('interactionCreate', async (inter) => {
  if (!inter.isChatInputCommand()) return;
  const uid = inter.user.id;

  if (inter.commandName === 'bonus') {
    const now = Date.now(), oneDay = 86_400_000;
    try {
      const { rows } = await pool.query('SELECT last_claim FROM bonus WHERE user_id=$1', [uid]);
      const last = rows[0]?.last_claim ?? 0;
      if (now - last < oneDay) {
        const h = Math.ceil((oneDay - (now - last)) / 3_600_000);
        return inter.reply({ content: `⏳ Reviens dans ${h} h pour ton bonus.`, ephemeral: true });
      }

      await pool.query(`
        INSERT INTO koins(user_id,amount) VALUES ($1,5)
        ON CONFLICT(user_id) DO UPDATE SET amount = koins.amount + 5`, [uid]);

      await pool.query(`
        INSERT INTO bonus(user_id,last_claim) VALUES ($1,$2)
        ON CONFLICT(user_id) DO UPDATE SET last_claim = $2`, [uid, now]);

      return inter.reply({ content: '🎁 + 5 koins !', ephemeral: true });
    } catch (e) { console.error(e); return inter.reply({ content:'❌ Erreur bonus', ephemeral:true }); }
  }

  if (inter.commandName === 'dé') {
    const now = Date.now(), wait = 14_400_000;
    try {
      const { rows } = await pool.query('SELECT last_roll FROM rolls WHERE user_id=$1', [uid]);
      const last = rows[0]?.last_roll ?? 0;
      if (now - last < wait) {
        const m = Math.ceil((wait - (now - last)) / 60000);
        return inter.reply({ content:`⏳ Reviens dans ${m} min pour relancer le dé.`, ephemeral:true });
      }

      const roll = Math.floor(Math.random()*6)+1;
      const gain = roll * 2;

      await pool.query(
        `INSERT INTO koins(user_id, amount)
         VALUES ($1, $2)
         ON CONFLICT(user_id) DO UPDATE SET amount = koins.amount + $2`,
        [uid, gain]
      );

      await pool.query(
        `INSERT INTO rolls(user_id, last_roll)
         VALUES ($1, $2)
         ON CONFLICT(user_id) DO UPDATE SET last_roll = $2`,
        [uid, now]
      );

      return inter.reply({ content:`🎲 ${roll} ! Tu gagnes **${gain} koins**.`, ephemeral:true });
    } catch(e){ console.error(e); return inter.reply({content:'❌ Erreur dé',ephemeral:true}); }
  }

if (inter.commandName === 'pioche') {
  const now = Date.now(), wait = 90 * 60 * 1000;
  try {
    await inter.deferReply();
    const { rows } = await pool.query('SELECT last_draw FROM pioches WHERE user_id=$1', [uid]);
    const last = rows[0]?.last_draw ?? 0;
    if (now - last < wait) {
      const m = Math.ceil((wait - (now - last)) / 60000);
      return inter.editReply(`⏳ Attends encore ${m} min pour repiocher.\n💡 N'oublie pas : /bonus chaque jour et /dé toutes les 4h !`);
    }

    const rar = tirerRareté();
    const liste = cartes.filter(c => c.rarity === rar);
    const carte = liste[Math.floor(Math.random() * liste.length)];

    const dup = await pool.query('SELECT 1 FROM collection WHERE user_id=$1 AND card_id=$2', [uid, carte.id]);
    let msg = rarityReactions[rar][Math.floor(Math.random() * 4)];
    if (dup.rowCount) {
      const g = rarityKoins[rar];
      msg += `\n💰 Carte en double ! +${g} koins`;
      await pool.query(
        `INSERT INTO koins(user_id,amount) VALUES ($1,$2)
         ON CONFLICT(user_id) DO UPDATE SET amount = koins.amount + $2`,
        [uid, g]
      );
    }

    await pool.query('INSERT INTO collection(user_id,card_id) VALUES ($1,$2)', [uid, carte.id]);
    await pool.query(
      `INSERT INTO pioches(user_id,last_draw) VALUES ($1,$2)
       ON CONFLICT(user_id) DO UPDATE SET last_draw = $2`,
      [uid, now]
    );

    const embed = {
      title: `#${carte.id} • ${rarityEmojis[rar]} ${carte.name}`,
      description: `${msg}\nRareté : *${rar}*`,
      color: rarityColors[rar]
    };
    return inter.editReply({ embeds: [embed], files: [carte.image] });

  } catch (e) {
    console.error(e);
    return inter.editReply('❌ Erreur pioche');
  }
}

// -------- /booster --------
if (inter.commandName === 'booster') {
  try {
    await inter.deferReply();

    const { rows } = await pool.query('SELECT amount FROM koins WHERE user_id=$1', [uid]);
    const solde = rows[0]?.amount ?? 0;
    if (solde < boosterCost)
      return inter.editReply(`💸 Il faut ${boosterCost} koins (tu en as ${solde}).\n💡 Tu peux faire /bonus chaque jour et /dé toutes les 4h pour en gagner !`);

    await pool.query('UPDATE koins SET amount = amount - $2 WHERE user_id = $1', [uid, boosterCost]);

    const tirages = [];

    for (let i = 0; i < 3; i++) {
      const rar = tirerRareté();
      const liste = cartes.filter(c => c.rarity === rar);
      const carte = liste[Math.floor(Math.random() * liste.length)];

      const dup = await pool.query(
        'SELECT 1 FROM collection WHERE user_id=$1 AND card_id=$2',
        [uid, carte.id]
      );

      let doublon = false;
      if (dup.rowCount) {
        const gain = rarityKoins[rar];
        await pool.query(
          `INSERT INTO koins(user_id, amount)
           VALUES ($1, $2)
           ON CONFLICT(user_id) DO UPDATE SET amount = koins.amount + $2`,
          [uid, gain]
        );
        doublon = gain;
      }

      await pool.query('INSERT INTO collection(user_id, card_id) VALUES ($1, $2)', [uid, carte.id]);
      tirages.push({ carte, doublon });
    }

    await inter.editReply('📦 Booster ouvert !');

    for (const { carte, doublon } of tirages) {
      const embed = {
        title: `#${carte.id} • ${rarityEmojis[carte.rarity]} ${carte.name}`,
        color: rarityColors[carte.rarity],
        description: `Rareté : *${carte.rarity}*` + (doublon ? `\n💰 Carte en double ! +${doublon} koins` : "")
      };
      await inter.followUp({ embeds: [embed], files: [carte.image] });
    }

  } catch (e) {
    console.error(e);
    return inter.editReply('❌ Erreur booster');
  }
}


  if (inter.commandName === 'kollek'){
    try{
      await inter.deferReply();
      const col = await pool.query('SELECT card_id FROM collection WHERE user_id=$1', [uid]);
      if (!col.rowCount) return inter.editReply('😢 Aucune carte.');

      const ko = await pool.query('SELECT amount FROM koins WHERE user_id=$1',[uid]);
      const solde = ko.rows[0]?.amount ?? 0;

      const map = {};
      col.rows.forEach(r => map[r.card_id] = (map[r.card_id]||0)+1);

     const lignes = Object.entries(map).map(([id, n]) => {
      const c = cartes.find(x => x.id === Number(id));
  return `#${c.id} • **${c.name}** × ${n} (*${c.rarity}*)`;
});


      const embeds=[];
      for(let i=0;i<lignes.length;i+=10){
        embeds.push({
          title:`📘 Collection de ${inter.user.username} (${Math.floor(i/10)+1}/${Math.ceil(lignes.length/10)})`,
          description:lignes.slice(i,i+10).join('\n')+
            `\n\nTotal : ${col.rowCount} cartes\n💰 Koins : ${solde}`,
          color:0x3498db
        });
      }

      if (embeds.length===1) return inter.editReply({embeds});
      const row=new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('◀️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('next').setLabel('▶️').setStyle(ButtonStyle.Secondary)
      );
      let page=0;
      const msg=await inter.editReply({embeds:[embeds[0]], components:[row]});
      const collector=msg.createMessageComponentCollector({time:60_000});
      collector.on('collect',async i=>{
        if(i.user.id!==uid) return i.reply({ content:'Pas ton menu !',ephemeral:true});
        page = i.customId==='next' ? (page+1)%embeds.length : (page-1+embeds.length)%embeds.length;
        await i.update({ embeds:[embeds[page]]});
      });
    }catch(e){ console.error(e); return inter.editReply('❌ Erreur kollek'); }
  }

  if (inter.commandName === 'aide') {
    const embed = {
      title:'📖 Aide Kollek',
      description:'Commandes disponibles',
      fields:[
        {name:'/pioche',  value:'Tirer 1 carte (90 min de CD)'},
        {name:'/booster', value:'Booster de 3 cartes pour 10 koins'},
        {name:'/kollek',  value:'Voir ta collection'},
        {name:'/bonus',   value:'+5 koins / 24 h'},
        {name:'/dé',      value:'Dé 6 faces – gain (face×2) / 4 h'}
      ],
      color:0x2ecc71
    };
    return inter.reply({ embeds:[embed], ephemeral:true });
  }
});

// ────────────────────────── LOGIN ──────────────────────────
client.login(process.env.DISCORD_TOKEN);
