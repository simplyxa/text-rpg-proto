const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const DB_FILE = path.join(__dirname, 'db.json');

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = {
      characters: {},
      locations: [
        {
          id: 'town',
          name: 'Город',
          description: 'Тихий город. Можно отдохнуть, купить зелья и подготовиться к бою.',
          monsters: []
        },
        {
          id: 'forest',
          name: 'Лес',
          description: 'Темный лес. Здесь встречаются гоблины и волки.',
          monsters: ['goblin', 'wolf']
        },
        {
          id: 'cave',
          name: 'Пещера',
          description: 'Зловещая пещера, где прячутся бандиты и опасные существа.',
          monsters: ['bandit', 'slime']
        }
      ],
      monsters: {
        goblin: { id: 'goblin', name: 'Гоблин', hp: 14, atk: 4, def: 1, xp: 10, gold: 7 },
        wolf: { id: 'wolf', name: 'Волк', hp: 18, atk: 5, def: 1, xp: 15, gold: 10 },
        bandit: { id: 'bandit', name: 'Бандит', hp: 24, atk: 7, def: 2, xp: 18, gold: 18 },
        slime: { id: 'slime', name: 'Слизь', hp: 16, atk: 4, def: 1, xp: 12, gold: 9 }
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  }

  const raw = fs.readFileSync(DB_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    const repaired = {
      characters: {},
      locations: [
        { id: 'town', name: 'Город', description: 'Тихий город.', monsters: [] },
        { id: 'forest', name: 'Лес', description: 'Темный лес.', monsters: ['goblin', 'wolf'] },
        { id: 'cave', name: 'Пещера', description: 'Зловещая пещера.', monsters: ['bandit', 'slime'] }
      ],
      monsters: {
        goblin: { id: 'goblin', name: 'Гоблин', hp: 14, atk: 4, def: 1, xp: 10, gold: 7 },
        wolf: { id: 'wolf', name: 'Волк', hp: 18, atk: 5, def: 1, xp: 15, gold: 10 },
        bandit: { id: 'bandit', name: 'Бандит', hp: 24, atk: 7, def: 2, xp: 18, gold: 18 },
        slime: { id: 'slime', name: 'Слизь', hp: 16, atk: 4, def: 1, xp: 12, gold: 9 }
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(repaired, null, 2));
    return repaired;
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

function buildCharacter(name, classId) {
  const base = { hp: 30, str: 5, agi: 4, int: 3 };
  if (classId === 'warrior') base.str += 2;
  if (classId === 'rogue') base.agi += 2;
  if (classId === 'mage') base.int += 2;

  return {
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

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/world', (req, res) => {
  const db = loadDB();
  res.json({
    locations: db.locations,
    monsters: db.monsters
  });
});

app.get('/api/locations', (req, res) => {
  const db = loadDB();
  res.json(db.locations);
});

app.post('/api/createCharacter', (req, res) => {
  const { name, classId } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Нужно имя персонажа.' });

  const db = loadDB();
  const cleanName = name.trim();
  if (db.characters[cleanName]) return res.status(400).json({ error: 'Персонаж с таким именем уже существует.' });

  const classMap = ['warrior', 'rogue', 'mage'];
  const finalClass = classMap.includes(classId) ? classId : 'warrior';

  const char = buildCharacter(cleanName, finalClass);
  db.characters[cleanName] = char;
  saveDB(db);
  res.json({ character: char });
});

app.get('/api/character', (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).json({ error: 'Нужно имя персонажа.' });

  const db = loadDB();
  const char = db.characters[name];
  if (!char) return res.status(404).json({ error: 'Персонаж не найден.' });
  updateQuests(char);
  res.json({ character: char });
});

app.post('/api/travel', (req, res) => {
  const { name, to } = req.body;
  const db = loadDB();
  const char = db.characters[name];
  const loc = db.locations.find((l) => l.id === to);

  if (!char || !loc) return res.status(400).json({ error: 'Неверные данные для перемещения.' });

  char.location = to;
  saveDB(db);
  res.json({ location: loc, character: char });
});

app.post('/api/fight', (req, res) => {
  const { name } = req.body;
  const db = loadDB();
  const char = db.characters[name];

  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });

  const loc = db.locations.find((l) => l.id === char.location);
  if (!loc || !loc.monsters || loc.monsters.length === 0) {
    return res.json({ message: 'Здесь нет врагов.', character: char });
  }

  const monsterId = loc.monsters[randInt(0, loc.monsters.length - 1)];
  const template = db.monsters[monsterId];
  const monster = { ...template };
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

    db.characters[name] = char;
    saveDB(db);
    return res.json({ victory: true, log, character: char });
  }

  char.hp = Math.max(1, Math.floor(char.maxHp / 2));
  char.gold = Math.max(0, char.gold - Math.floor(char.gold * 0.1));
  char.location = 'town';
  log.push(`${char.name} был(а) побежден(а), отступил(а) в город и потерял(а) часть золота.`);

  db.characters[name] = char;
  saveDB(db);
  res.json({ victory: false, log, character: char });
});

app.get('/api/inventory', (req, res) => {
  const name = req.query.name;
  const db = loadDB();
  const char = db.characters[name];

  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });
  res.json({ inventory: char.inventory });
});

app.post('/api/useItem', (req, res) => {
  const { name, idx } = req.body;
  const db = loadDB();
  const char = db.characters[name];

  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });

  const item = char.inventory[idx];
  if (!item) return res.status(400).json({ error: 'Предмет не найден.' });

  if (item.id === 'potion' || item.id === 'food') {
    const healed = item.heal || 10;
    char.hp = Math.min(char.maxHp, char.hp + healed);
    item.qty -= 1;
    if (item.qty <= 0) char.inventory.splice(idx, 1);
    saveDB(db);
    return res.json({ message: `Использован ${item.name}. Восстановлено ${healed} HP.`, character: char });
  }

  res.status(400).json({ error: 'Этот предмет нельзя использовать.' });
});

app.get('/api/quests', (req, res) => {
  const name = req.query.name;
  const db = loadDB();
  const char = db.characters[name];

  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });
  updateQuests(char);
  res.json({ quests: char.quests });
});

app.post('/api/buyPotion', (req, res) => {
  const { name } = req.body;
  const db = loadDB();
  const char = db.characters[name];

  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });
  if (char.gold < 10) return res.status(400).json({ error: 'Недостаточно золота.' });

  char.gold -= 10;
  const existing = char.inventory.find((item) => item.id === 'potion');
  if (existing) existing.qty += 1;
  else char.inventory.push({ id: 'potion', name: 'Зелье лечения', qty: 1, heal: 15 });

  saveDB(db);
  res.json({ message: 'Куплено зелье лечения.', character: char });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));
