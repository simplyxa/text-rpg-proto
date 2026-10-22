const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

const FACTIONS = ['light', 'dark'];

function stripPassword(character) {
  if (!character) return null;
  const copy = { ...character };
  delete copy.passwordHash;
  delete copy.passwordhash;
  return copy;
}

function createDefaultQuests() {
  return [
    {
      id: 'first_battle',
      title: 'Первый бой',
      description: 'Победите первого монстра.',
      type: 'kills',
      target: 1,
      progress: 0,
      done: false,
      reward: { gold: 25 }
    },
    {
      id: 'town_guard',
      title: 'Служба в городе',
      description: 'Поднимитесь на 2-й уровень.',
      type: 'level',
      target: 2,
      progress: 0,
      done: false,
      reward: { gold: 60, potion: 1 }
    }
  ];
}

function buildCharacter(name, classId, passwordHash, faction = 'light', id = uid()) {
  const base = { hp: 30, str: 5, agi: 4, int: 3 };
  if (classId === 'warrior') base.str += 2;
  if (classId === 'rogue') base.agi += 2;
  if (classId === 'mage') base.int += 2;

  return {
    id,
    name,
    classId: classId || 'warrior',
    faction: faction || 'light',
    level: 1,
    xp: 0,
    xpToNext: 30,
    maxHp: base.hp,
    hp: base.hp,
    str: base.str,
    agi: base.agi,
    int: base.int,
    gold: 12,
    location: 'town',
    kills: 0,
    inventory: [
      { id: 'potion', name: 'Зелье лечения', qty: 2, heal: 15 },
      { id: 'food', name: 'Пирожок', qty: 1, heal: 8 }
    ],
    quests: createDefaultQuests(),
    passwordHash: passwordHash || null,
    createdAt: Date.now()
  };
}

function updateQuests(char) {
  const levelQuest = char.quests.find((q) => q.id === 'town_guard');
  if (levelQuest) {
    levelQuest.progress = char.level;
    levelQuest.done = char.level >= levelQuest.target;
  }

  const battleQuest = char.quests.find((q) => q.id === 'first_battle');
  if (battleQuest) {
    battleQuest.progress = char.kills;
    battleQuest.done = char.kills >= battleQuest.target;
  }
}

function serializeCharacter(character) {
  return {
    id: character.id,
    name: character.name,
    classId: character.classId,
    faction: character.faction || 'light',
    level: character.level,
    xp: character.xp,
    xpToNext: character.xpToNext,
    maxHp: character.maxHp,
    hp: character.hp,
    str: character.str,
    agi: character.agi,
    int: character.int,
    gold: character.gold,
    location: character.location,
    kills: character.kills,
    inventory: JSON.stringify(character.inventory || []),
    quests: JSON.stringify(character.quests || []),
    passwordHash: character.passwordHash || null,
    createdAt: character.createdAt || Date.now()
  };
}

function deserializeCharacter(row) {
  if (!row) return null;

  const inventory = Array.isArray(row.inventory)
    ? row.inventory
    : (typeof row.inventory === 'string' ? JSON.parse(row.inventory || '[]') : []);

  const quests = Array.isArray(row.quests)
    ? row.quests
    : (typeof row.quests === 'string' ? JSON.parse(row.quests || JSON.stringify(createDefaultQuests())) : createDefaultQuests());

  return {
    id: row.id,
    name: row.name,
    classId: row.classid || row.classId,
    faction: row.faction || 'light',
    level: row.level,
    xp: row.xp,
    xpToNext: row.xptonext || row.xpToNext,
    maxHp: row.maxhp || row.maxHp,
    hp: row.hp,
    str: row.str,
    agi: row.agi,
    int: row.int,
    gold: row.gold,
    location: row.location,
    kills: row.kills,
    inventory,
    quests,
    passwordHash: row.passwordhash || row.passwordHash,
    createdAt: row.createdat || row.createdAt
  };
}

async function initDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  const needed = [
    'id TEXT',
    'name TEXT',
    'classid TEXT',
    "faction TEXT DEFAULT 'light'",
    'level INTEGER',
    'xp INTEGER',
    'xptonext INTEGER',
    'maxhp INTEGER',
    'hp INTEGER',
    'str INTEGER',
    'agi INTEGER',
    'int INTEGER',
    'gold INTEGER',
    'location TEXT',
    'kills INTEGER',
    'inventory TEXT',
    'quests TEXT',
    'passwordhash TEXT',
    'createdat BIGINT'
  ];

  const columns = await pool.query(`
    SELECT lower(column_name) AS column_name
    FROM information_schema.columns
    WHERE table_name = 'characters'
  `);

  const present = new Set(columns.rows.map((r) => r.column_name));

  const createTableSql = `
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      name TEXT,
      classid TEXT,
      faction TEXT DEFAULT 'light',
      level INTEGER,
      xp INTEGER,
      xptonext INTEGER,
      maxhp INTEGER,
      hp INTEGER,
      str INTEGER,
      agi INTEGER,
      int INTEGER,
      gold INTEGER,
      location TEXT,
      kills INTEGER,
      inventory TEXT,
      quests TEXT,
      passwordhash TEXT,
      createdat BIGINT
    )
  `;

  await pool.query(createTableSql);

  for (const colDef of needed) {
    const [columnName, columnType] = colDef.split(' ');
    const normalized = columnName.toLowerCase();
    if (!present.has(normalized)) {
      await pool.query(`ALTER TABLE characters ADD COLUMN ${normalized} ${columnType}`);
    }
  }
}

async function saveCharacter(character) {
  const row = serializeCharacter(character);
  await pool.query(
    `INSERT INTO characters (
      id, name, classid, faction, level, xp, xptonext, maxhp, hp, str, agi, int, gold, location, kills, inventory, quests, passwordhash, createdat
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      classid = EXCLUDED.classid,
      faction = EXCLUDED.faction,
      level = EXCLUDED.level,
      xp = EXCLUDED.xp,
      xptonext = EXCLUDED.xptonext,
      maxhp = EXCLUDED.maxhp,
      hp = EXCLUDED.hp,
      str = EXCLUDED.str,
      agi = EXCLUDED.agi,
      int = EXCLUDED.int,
      gold = EXCLUDED.gold,
      location = EXCLUDED.location,
      kills = EXCLUDED.kills,
      inventory = EXCLUDED.inventory,
      quests = EXCLUDED.quests,
      passwordhash = EXCLUDED.passwordhash,
      createdat = EXCLUDED.createdat`,
    [
      row.id,
      row.name,
      row.classId,
      row.faction,
      row.level,
      row.xp,
      row.xpToNext,
      row.maxHp,
      row.hp,
      row.str,
      row.agi,
      row.int,
      row.gold,
      row.location,
      row.kills,
      row.inventory,
      row.quests,
      row.passwordHash,
      row.createdAt
    ]
  );
}

async function listCharacters() {
  const result = await pool.query('SELECT * FROM characters ORDER BY createdat DESC');
  return result.rows.map((row) => stripPassword(deserializeCharacter(row)));
}

async function loadCharacterById(id) {
  const result = await pool.query('SELECT * FROM characters WHERE id = $1', [id]);
  return stripPassword(deserializeCharacter(result.rows[0]));
}

async function loadCharacterByName(name) {
  const result = await pool.query('SELECT * FROM characters WHERE name = $1', [name]);
  return stripPassword(deserializeCharacter(result.rows[0]));
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/characters', async (req, res) => {
  const characters = await listCharacters();
  res.json({ characters });
});

app.get('/api/world', (req, res) => {
  res.json({
    locations: [
      { id: 'town', name: 'Город', description: 'Тихий город. Можно отдохнуть, купить зелья и подготовиться к бою.', monsters: [] },
      { id: 'forest', name: 'Лес', description: 'Темный лес. Здесь встречаются гоблины и волки.', monsters: ['goblin', 'wolf'] },
      { id: 'cave', name: 'Пещера', description: 'Зловещая пещера, где прячутся бандиты и опасные существа.', monsters: ['bandit', 'slime'] }
    ],
    monsters: {
      goblin: { id: 'goblin', name: 'Гоблин', hp: 14, atk: 4, def: 1, xp: 10, gold: 7 },
      wolf: { id: 'wolf', name: 'Волк', hp: 18, atk: 5, def: 1, xp: 15, gold: 10 },
      bandit: { id: 'bandit', name: 'Бандит', hp: 24, atk: 7, def: 2, xp: 18, gold: 18 },
      slime: { id: 'slime', name: 'Слизь', hp: 16, atk: 4, def: 1, xp: 12, gold: 9 }
    }
  });
});

app.get('/api/locations', (req, res) => {
  res.json([
    { id: 'town', name: 'Город', description: 'Тихий город. Можно отдохнуть, купить зелья и подготовиться к бою.', monsters: [] },
    { id: 'forest', name: 'Лес', description: 'Темный лес. Здесь встречаются гоблины и волки.', monsters: ['goblin', 'wolf'] },
    { id: 'cave', name: 'Пещера', description: 'Зловещая пещера, где прячутся бандиты и опасные существа.', monsters: ['bandit', 'slime'] }
  ]);
});

app.post('/api/registerCharacter', async (req, res) => {
  const { nickname, classId, faction, password } = req.body;
  const cleanName = String(nickname || '').trim();

  if (!cleanName) return res.status(400).json({ error: 'Введите уникальный ник.' });
  if (cleanName.length < 3) return res.status(400).json({ error: 'Ник должен быть не короче 3 символов.' });

  const passwordValue = String(password || '').trim();
  if (!passwordValue) return res.status(400).json({ error: 'Придумайте пароль для входа.' });
  if (passwordValue.length < 4) return res.status(400).json({ error: 'Пароль должен содержать минимум 4 символа.' });

  const existing = await loadCharacterByName(cleanName);
  if (existing) return res.status(409).json({ error: 'Такой ник уже занят.' });

  const classMap = ['warrior', 'rogue', 'mage', 'healer'];
  const finalClass = classMap.includes(classId) ? classId : 'warrior';
  const finalFaction = FACTIONS.includes(faction) ? faction : 'light';

  const character = buildCharacter(cleanName, finalClass, hashPassword(passwordValue), finalFaction);
  await saveCharacter(character);
  res.json({ character: stripPassword(character), notice: 'Советуем придумать пароль к 10 уровню и не хранить его в открытом виде.' });
});

app.post('/api/loginCharacter', async (req, res) => {
  const { nickname, password } = req.body;
  const cleanName = String(nickname || '').trim();
  const passwordValue = String(password || '').trim();

  if (!cleanName || !passwordValue) {
    return res.status(400).json({ error: 'Введите ник и пароль.' });
  }

  const stored = await loadCharacterByName(cleanName);
  if (!stored) return res.status(404).json({ error: 'Персонаж не найден.' });

  const expectedHash = hashPassword(passwordValue);
  if (stored.passwordHash !== expectedHash) {
    return res.status(401).json({ error: 'Неверный пароль.' });
  }

  res.json({ character: stripPassword(stored) });
});

app.get('/api/character', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Нужно id персонажа.' });

  const char = await loadCharacterById(id);
  if (!char) return res.status(404).json({ error: 'Персонаж не найден.' });

  updateQuests(char);
  await saveCharacter(char);
  res.json({ character: stripPassword(char) });
});

app.post('/api/updateCharacter', async (req, res) => {
  const { id, classId, faction } = req.body;
  if (!id) return res.status(400).json({ error: 'Нужно id персонажа.' });

  const char = await loadCharacterById(id);
  if (!char) return res.status(404).json({ error: 'Персонаж не найден.' });

  if (['warrior', 'rogue', 'mage', 'healer'].includes(classId)) char.classId = classId;
  if (FACTIONS.includes(faction)) char.faction = faction;

  await saveCharacter(char);
  res.json({ character: stripPassword(char) });
});

app.post('/api/travel', async (req, res) => {
  const { id, to } = req.body;
  const char = await loadCharacterById(id);
  const locs = [
    { id: 'town', name: 'Город', description: 'Тихий город. Можно отдохнуть, купить зелья и подготовиться к бою.', monsters: [] },
    { id: 'forest', name: 'Лес', description: 'Темный лес. Здесь встречаются гоблины и волки.', monsters: ['goblin', 'wolf'] },
    { id: 'cave', name: 'Пещера', description: 'Зловещая пещера, где прячутся бандиты и опасные существа.', monsters: ['bandit', 'slime'] }
  ];
  const loc = locs.find((l) => l.id === to);

  if (!char || !loc) return res.status(400).json({ error: 'Неверные данные для перемещения.' });

  char.location = to;
  await saveCharacter(char);
  res.json({ location: loc, character: stripPassword(char) });
});

app.post('/api/fight', async (req, res) => {
  const { id } = req.body;
  let char = await loadCharacterById(id);
  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });

  const locs = [
    { id: 'town', name: 'Город', description: 'Тихий город. Можно отдохнуть, купить зелья и подготовиться к бою.', monsters: [] },
    { id: 'forest', name: 'Лес', description: 'Темный лес. Здесь встречаются гоблины и волки.', monsters: ['goblin', 'wolf'] },
    { id: 'cave', name: 'Пещера', description: 'Зловещая пещера, где прячутся бандиты и опасные существа.', monsters: ['bandit', 'slime'] }
  ];
  const loc = locs.find((l) => l.id === char.location);

  if (!loc || !loc.monsters || loc.monsters.length === 0) {
    return res.json({ message: 'Здесь нет врагов.', character: stripPassword(char) });
  }

  const monsters = {
    goblin: { id: 'goblin', name: 'Гоблин', hp: 14, atk: 4, def: 1, xp: 10, gold: 7 },
    wolf: { id: 'wolf', name: 'Волк', hp: 18, atk: 5, def: 1, xp: 15, gold: 10 },
    bandit: { id: 'bandit', name: 'Бандит', hp: 24, atk: 7, def: 2, xp: 18, gold: 18 },
    slime: { id: 'slime', name: 'Слизь', hp: 16, atk: 4, def: 1, xp: 12, gold: 9 }
  };

  const monsterId = loc.monsters[randInt(0, loc.monsters.length - 1)];
  const monster = { ...monsters[monsterId] };
  const log = [];

  while (char.hp > 0 && monster.hp > 0) {
    const playerRoll = randInt(1, 6) + char.str + Math.floor(char.level / 2);
    const monsterRoll = randInt(1, 6) + Math.max(0, monster.def);
    const damage = Math.max(1, playerRoll - monsterRoll);

    monster.hp -= damage;
    log.push(`${char.name} наносит ${damage} урона ${monster.name}.`);

    if (monster.hp <= 0) break;

    const monsterDamage = Math.max(1, monster.atk + randInt(0, 3) - Math.floor(char.agi / 3));
    char.hp -= monsterDamage;
    log.push(`${monster.name} наносит ${monsterDamage} урона ${char.name}.`);
  }

  if (char.hp > 0) {
    char.kills += 1;
    char.xp += monster.xp;
    char.gold += monster.gold;
    log.push(`${char.name} победил(а) ${monster.name}! Получено ${monster.xp} XP и ${monster.gold} золота.`);

    while (char.xp >= char.xpToNext) {
      char.xp -= char.xpToNext;
      char.level += 1;
      char.str += 1;
      char.agi += 1;
      char.int += 1;
      char.maxHp += 5;
      char.hp = char.maxHp;
      char.xpToNext = Math.round(char.xpToNext * 1.4);
      log.push(`${char.name} достиг(ла) уровня ${char.level}!`);
    }

    if (Math.random() < 0.6) {
      const loot = { id: 'potion', name: 'Зелье лечения', qty: 1, heal: 15 };
      const existing = char.inventory.find((item) => item.id === loot.id);
      if (existing) {
        existing.qty += loot.qty;
      } else {
        char.inventory.push(loot);
      }
      log.push(`Найден предмет: ${loot.name} x${loot.qty}`);
    }

    updateQuests(char);
    if (char.quests.every((q) => q.done)) {
      const bonusGold = 50;
      char.gold += bonusGold;
      log.push(`Все квесты выполнены! Получено ${bonusGold} золота в награду.`);
    }

    await saveCharacter(char);
    return res.json({ victory: true, log, character: stripPassword(char) });
  }

  char.hp = Math.max(1, Math.floor(char.maxHp / 2));
  char.gold = Math.max(0, char.gold - Math.floor(char.gold * 0.1));
  char.location = 'town';
  log.push(`${char.name} был(а) побежден(а), отступил(а) в город и потерял(а) часть золота.`);

  await saveCharacter(char);
  res.json({ victory: false, log, character: stripPassword(char) });
});

app.get('/api/inventory', async (req, res) => {
  const id = req.query.id;
  const char = await loadCharacterById(id);
  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });
  res.json({ inventory: char.inventory });
});

app.post('/api/useItem', async (req, res) => {
  const { id, idx } = req.body;
  const char = await loadCharacterById(id);
  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });

  const item = char.inventory[idx];
  if (!item) return res.status(400).json({ error: 'Предмет не найден.' });

  if (item.id === 'potion' || item.id === 'food') {
    const healed = item.heal || 10;
    char.hp = Math.min(char.maxHp, char.hp + healed);
    item.qty -= 1;
    if (item.qty <= 0) char.inventory.splice(idx, 1);
    await saveCharacter(char);
    return res.json({ message: `Использован ${item.name}. Восстановлено ${healed} HP.`, character: stripPassword(char) });
  }

  return res.status(400).json({ error: '��тот предмет нельзя использовать.' });
});

app.get('/api/quests', async (req, res) => {
  const id = req.query.id;
  const char = await loadCharacterById(id);
  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });

  updateQuests(char);
  await saveCharacter(char);
  res.json({ quests: char.quests });
});

app.post('/api/buyPotion', async (req, res) => {
  const { id } = req.body;
  const char = await loadCharacterById(id);
  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });
  if (char.gold < 10) return res.status(400).json({ error: 'Недостаточно золота.' });

  char.gold -= 10;
  const existing = char.inventory.find((item) => item.id === 'potion');
  if (existing) existing.qty += 1;
  else char.inventory.push({ id: 'potion', name: 'Зелье лечения', qty: 1, heal: 15 });

  await saveCharacter(char);
  res.json({ message: 'Куплено зелье лечения.', character: stripPassword(char) });
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, initDatabase };
