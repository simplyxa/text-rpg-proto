const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
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

function buildCharacter(name, classId, id = uid()) {
  const base = { hp: 30, str: 5, agi: 4, int: 3 };
  if (classId === 'warrior') base.str += 2;
  if (classId === 'rogue') base.agi += 2;
  if (classId === 'mage') base.int += 2;

  return {
    id,
    name,
    classId: classId || 'warrior',
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
    inventory: Array.isArray(character.inventory) ? character.inventory : [],
    quests: Array.isArray(character.quests) ? character.quests : createDefaultQuests(),
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
    createdAt: row.createdat || row.createdAt
  };
}

async function initDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      name TEXT,
      classId TEXT,
      level INTEGER,
      xp INTEGER,
      xpToNext INTEGER,
      maxHp INTEGER,
      hp INTEGER,
      str INTEGER,
      agi INTEGER,
      int INTEGER,
      gold INTEGER,
      location TEXT,
      kills INTEGER,
      inventory JSONB NOT NULL DEFAULT '[]'::jsonb,
      quests JSONB NOT NULL DEFAULT '[]'::jsonb,
      createdAt BIGINT
    )
  `);
}

async function dbRun(sql, params = []) {
  return pool.query(sql, params);
}

async function dbGet(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0];
}

async function dbAll(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function saveCharacter(character) {
  const row = serializeCharacter(character);
  await dbRun(
    `INSERT INTO characters (
      id, name, classId, level, xp, xpToNext, maxHp, hp, str, agi, int, gold, location, kills, inventory, quests, createdAt
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      classId = EXCLUDED.classId,
      level = EXCLUDED.level,
      xp = EXCLUDED.xp,
      xpToNext = EXCLUDED.xpToNext,
      maxHp = EXCLUDED.maxHp,
      hp = EXCLUDED.hp,
      str = EXCLUDED.str,
      agi = EXCLUDED.agi,
      int = EXCLUDED.int,
      gold = EXCLUDED.gold,
      location = EXCLUDED.location,
      kills = EXCLUDED.kills,
      inventory = EXCLUDED.inventory,
      quests = EXCLUDED.quests,
      createdAt = EXCLUDED.createdAt`,
    [
      row.id,
      row.name,
      row.classId,
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
      row.createdAt
    ]
  );
}

async function listCharacters() {
  const rows = await dbAll('SELECT * FROM characters ORDER BY createdAt DESC');
  return rows.map(deserializeCharacter);
}

async function loadCharacterById(id) {
  const row = await dbGet('SELECT * FROM characters WHERE id = $1', [id]);
  return deserializeCharacter(row);
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

app.post('/api/createCharacter', async (req, res) => {
  const { name, classId } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Нужно имя персонажа.' });

  const cleanName = name.trim();
  const classMap = ['warrior', 'rogue', 'mage'];
  const finalClass = classMap.includes(classId) ? classId : 'warrior';

  const character = buildCharacter(cleanName, finalClass);
  await saveCharacter(character);
  res.json({ character });
});

app.get('/api/character', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Нужно id персонажа.' });

  const char = await loadCharacterById(id);
  if (!char) return res.status(404).json({ error: 'Персонаж не найден.' });

  updateQuests(char);
  await saveCharacter(char);
  res.json({ character: char });
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
  res.json({ location: loc, character: char });
});

app.post('/api/fight', async (req, res) => {
  const { id } = req.body;
  const char = await loadCharacterById(id);
  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });

  const locs = [
    { id: 'town', name: 'Город', description: 'Тихий город. Можно отдохнуть, купить зелья и подготовиться к бою.', monsters: [] },
    { id: 'forest', name: 'Лес', description: 'Темный лес. Здесь встречаются гоблины и волки.', monsters: ['goblin', 'wolf'] },
    { id: 'cave', name: 'Пещера', description: 'Зловещая пещера, где прячутся бандиты и опасные существа.', monsters: ['bandit', 'slime'] }
  ];
  const loc = locs.find((l) => l.id === char.location);

  if (!loc || !loc.monsters || loc.monsters.length === 0) {
    return res.json({ message: 'Здесь нет врагов.', character: char });
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
    return res.json({ victory: true, log, character: char });
  }

  char.hp = Math.max(1, Math.floor(char.maxHp / 2));
  char.gold = Math.max(0, char.gold - Math.floor(char.gold * 0.1));
  char.location = 'town';
  log.push(`${char.name} был(а) побежден(а), отступил(а) в город и потерял(а) часть золота.`);

  await saveCharacter(char);
  res.json({ victory: false, log, character: char });
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
    return res.json({ message: `Использован ${item.name}. Восстановлено ${healed} HP.`, character: char });
  }

  return res.status(400).json({ error: 'Этот предмет нельзя использовать.' });
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
  res.json({ message: 'Куплено зелье лечения.', character: char });
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

