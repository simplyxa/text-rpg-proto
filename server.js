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
        { id: 'town', name: 'Город', description: 'Тихий город. Можно отдохнуть.', monsters: [] },
        { id: 'forest', name: 'Лес', description: 'Темный лес. Появляются гоблины и волки.', monsters: ['goblin','wolf'] },
        { id: 'cave', name: 'Пещера', description: 'Зловещая пещера. Скрываются бандиты.', monsters: ['bandit'] }
      ],
      monsters: {
        goblin: { id: 'goblin', name: 'Гоблин', hp: 10, atk: 3, def: 0, xp: 8, gold: 5 },
        wolf: { id: 'wolf', name: 'Волк', hp: 14, atk: 4, def: 1, xp: 12, gold: 8 },
        bandit: { id: 'bandit', name: 'Бандит', hp: 20, atk: 6, def: 2, xp: 20, gold: 20 }
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function randInt(a,b) { return Math.floor(Math.random()*(b-a+1))+a; }

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname,'public')));

// API
app.get('/api/locations', (req,res)=>{
  const db = loadDB();
  res.json(db.locations);
});

app.post('/api/createCharacter', (req,res)=>{
  const { name, classId } = req.body;
  if (!name) return res.status(400).json({ error: 'Нужно имя' });
  const db = loadDB();
  if (db.characters[name]) return res.status(400).json({ error: 'Персонаж с таким именем уже есть' });

  const base = { hp:30, str:5, agi:4, int:3 };
  if (classId === 'warrior') base.str += 2;
  if (classId === 'rogue') base.agi += 2;
  if (classId === 'mage') base.int += 2;

  const char = {
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
    gold: 10,
    location: 'town',
    inventory: [{ id: 'potion', name: 'Зелье лечения', qty: 2, heal: 15 }],
    createdAt: Date.now()
  };
  db.characters[name] = char;
  saveDB(db);
  res.json({ character: char });
});

app.get('/api/character', (req,res)=>{
  const name = req.query.name;
  if (!name) return res.status(400).json({ error: 'Нужно имя' });
  const db = loadDB();
  const char = db.characters[name];
  if (!char) return res.status(404).json({ error: 'Не найден персонаж' });
  res.json({ character: char });
});

app.post('/api/travel', (req,res)=>{
  const { name, to } = req.body;
  const db = loadDB();
  const char = db.characters[name];
  const loc = db.locations.find(l=>l.id===to);
  if (!char || !loc) return res.status(400).json({ error: 'Неверные данные' });
  char.location = to;
  saveDB(db);
  res.json({ location: loc, character: char });
});

app.post('/api/fight', (req,res)=>{
  const { name } = req.body;
  const db = loadDB();
  const char = db.characters[name];
  if (!char) return res.status(400).json({ error: 'Персонаж не найден' });
  const loc = db.locations.find(l=>l.id===char.location);
  if (!loc || !loc.monsters || loc.monsters.length===0) {
    return res.json({ message: 'Здесь нет врагов.' });
  }
  const monId = loc.monsters[randInt(0, loc.monsters.length-1)];
  const monsterTemplate = db.monsters[monId];
  const monster = { ...monsterTemplate }; // copy
  const log = [];
  // simple fight loop
  while (char.hp > 0 && monster.hp > 0) {
    // player attack
    const playerRoll = randInt(1,6) + char.str;
    const monsterRoll = randInt(1,6) + monster.def;
    let dmg = Math.max(1, playerRoll - Math.floor(monster.def/2));
    monster.hp -= dmg;
    log.push(`${char.name} наносит ${dmg} урона ${monster.name}. (${Math.max(0,monster.hp)} HP у монстра)`);
    if (monster.hp <= 0) break;
    // monster attack
    const mDmg = Math.max(1, monster.atk + randInt(0,3) - Math.floor(char.agi/3));
    char.hp -= mDmg;
    log.push(`${monster.name} наносит ${mDmg} урона ${char.name}. (${Math.max(0,char.hp)} HP у персонажа)`);
  }

  let result = {};
  if (char.hp > 0) {
    // victory
    char.xp += monster.xp;
    char.gold += monster.gold;
    log.push(`${char.name} победил(а) ${monster.name}! Получено ${monster.xp} XP и ${monster.gold} золотых.`);
    // level up?
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
    // loot chance
    if (Math.random() < 0.5) {
      const found = { id: 'goldpouch', name: 'Мешочек золота', qty: randInt(1,3) };
      char.inventory.push(found);
      log.push(`Найден предмет: ${found.name} x${found.qty}`);
    }
    result.victory = true;
  } else {
    // defeated
    char.hp = Math.max(1, Math.floor(char.maxHp/2)); // revive with partial HP
    char.gold = Math.max(0, char.gold - Math.floor(char.gold*0.1));
    log.push(`${char.name} был(а) побежден(а)... Вы упали в городе и потеряли часть золота.`);
    char.location = 'town';
    result.victory = false;
  }

  db.characters[name] = char;
  saveDB(db);
  result.log = log;
  result.character = char;
  res.json(result);
});

app.get('/api/inventory', (req,res)=>{
  const name = req.query.name;
  const db = loadDB();
  const char = db.characters[name];
  if (!char) return res.status(400).json({ error: 'Персонаж не найден' });
  res.json({ inventory: char.inventory });
});

app.post('/api/useItem', (req,res)=>{
  const { name, idx } = req.body;
  const db = loadDB();
  const char = db.characters[name];
  if (!char) return res.status(400).json({ error: 'Персонаж не найден' });
  const item = char.inventory[idx];
  if (!item) return res.status(400).json({ error: 'Предмет не найден' });
  if (item.id === 'potion') {
    char.hp = Math.min(char.maxHp, char.hp + item.heal);
    item.qty -= 1;
    if (item.qty <= 0) char.inventory.splice(idx,1);
    saveDB(db);
    return res.json({ message: `Использовано зелье. Восстановлено ${item.heal} HP.`, character: char });
  } else if (item.id === 'goldpouch') {
    char.gold += item.qty * 5;
    char.inventory.splice(idx,1);
    saveDB(db);
    return res.json({ message: `Обменян мешочек на золото. +${item.qty*5} gold.`, character: char });
  } else {
    return res.status(400).json({ error: 'Нельзя использовать этот предмет' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Server started on http://localhost:${PORT}`));
