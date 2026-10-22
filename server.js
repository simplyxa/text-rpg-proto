const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');
const {
  DAMAGE_TYPES,
  TALENT_TREES,
  creditGold,
  getSalePrice,
  getTalentBonuses,
  normalizeGold,
  normalizeResistances,
  resolveCombatHit,
  spendGold,
  upgradeTalent
} = require('./game-systems');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const EQUIPMENT_SLOTS = ['helmet', 'chest', 'shield', 'hands', 'armor', 'boots', 'cloak', 'ring'];
const POTIONS = {
  potion_health: { name: 'Зелье Здоровья', effect: '+50 HP', type: 'health' },
  potion_mana: { name: 'Зелье Маны', effect: '+30 Mana', type: 'mana' },
  potion_strength: { name: 'Зелье Усиления', effect: '+5 Урона на 10 сек', type: 'strength' },
  potion_armor: { name: 'Зелье Защиты', effect: '+10 Защиты на 10 сек', type: 'armor' }
};

const LOCATIONS = [
  { id: 'town', name: 'Город', description: 'Тихий город. Можно отдохнуть, купить зелья и подготовиться к бою.', monsters: [] },
  { id: 'forest', name: 'Лес', description: 'Темный лес. Здесь встречаются гоблины и волки.', monsters: ['goblin', 'wolf'] },
  { id: 'cave', name: 'Пещера', description: 'Зловещая пещера, где прячутся бандиты и опасные существа.', monsters: ['bandit', 'slime'] }
];

const MONSTERS = {
  goblin: { id: 'goblin', name: 'Гоблин', hp: 14, atk: 4, def: 1, xp: 10, gold: 7 },
  wolf: { id: 'wolf', name: 'Волк', hp: 18, atk: 5, def: 1, xp: 15, gold: 10 },
  bandit: { id: 'bandit', name: 'Бандит', hp: 24, atk: 7, def: 2, xp: 18, gold: 18, rarity: 'rare' },
  slime: { id: 'slime', name: 'Слизь', hp: 16, atk: 4, def: 1, xp: 12, gold: 9, damageType: 'magic' }
};

const EQUIPMENT_DROP_TEMPLATES = [
  { slot: 'helmet', name: 'Шлем' },
  { slot: 'chest', name: 'Нагрудник' },
  { slot: 'shield', name: 'Щит' },
  { slot: 'hands', name: 'Перчатки' },
  { slot: 'armor', name: 'Доспех' },
  { slot: 'boots', name: 'Ботинки' },
  { slot: 'cloak', name: 'Плащ' },
  { slot: 'ring', name: 'Кольцо' }
];

const ITEM_PREFIXES = [
  { name: 'Крепкий', statBonus: { maxHp: 3 } },
  { name: 'Отточенный', statBonus: { attack: 1 } }
];
const ITEM_SUFFIXES = [
  { name: 'стойкости', statBonus: { defense: 1 } },
  { name: 'восстановления', statBonus: { healthRegen: 1 } }
];

const SHOP_EQUIPMENT = [
  { id: 'helmet', name: 'Шлем', slot: 'helmet', statBonus: { maxHp: 2, armor: 2 } },
  { id: 'amulet', name: 'Амулет', slot: 'ring', statBonus: { int: 1, armor: 1 } },
  { id: 'armor', name: 'Броня', slot: 'chest', statBonus: { str: 1, armor: 5 } },
  { id: 'gloves', name: 'Перчатки', slot: 'hands', statBonus: { agi: 1, armor: 1 } },
  { id: 'pants', name: 'Штаны', slot: 'armor', statBonus: { maxHp: 1, armor: 2 } },
  { id: 'boots', name: 'Сапоги', slot: 'boots', statBonus: { agi: 1, armor: 1 } },
  { id: 'left_blade', name: 'Левый клинок', slot: 'shield', statBonus: { str: 1, armor: 0 } },
  { id: 'right_blade', name: 'Правый клинок', slot: 'cloak', statBonus: { str: 1, armor: 3 } }
];
const SHOP_ITEM_PRICE = 1500;
const SHOP_SET_PRICE = 10000;
const ENHANCEMENT_COSTS = [100, 200, 300, 500, 800, 1200, 1800, 2500, 3500, 5000];
const ENHANCEMENT_CHANCES = [100, 95, 90, 85, 80, 70, 60, 50, 40, 30];
const LEGACY_SLOT_ARMOR = {
  helmet: 2,
  ring: 1,
  chest: 5,
  hands: 1,
  armor: 2,
  boots: 1,
  shield: 3,
  cloak: 0
};

function createEquipmentItem(id, name, slot, rarity, statBonus = {}) {
  const safeRarity = ['common', 'rare', 'epic', 'legendary'].includes(rarity) ? rarity : 'common';
  return {
    id,
    name,
    slot,
    rarity: safeRarity,
    enhancement: 0,
    statBonus: {
      str: 0,
      agi: 0,
      int: 0,
      maxHp: 0,
      armor: 0,
      attack: 0,
      defense: 0,
      healthRegen: 0,
      ...statBonus,
      resistances: { physical: 0, magic: 0, poison: 0, ...statBonus.resistances }
    },
    icon: `/equipment-icons.svg#${slot}`
  };
}

function normalizeEnhancementLevel(level) {
  return Math.min(10, Math.max(0, Math.floor(Number(level) || 0)));
}

function getEnhancedStat(baseStat, enhancementLevel) {
  return (Number(baseStat) || 0) * (1 + normalizeEnhancementLevel(enhancementLevel) * 0.1);
}

function createDefaultEquipment() {
  return {
    helmet: createEquipmentItem('iron_helmet', 'Железный шлем', 'helmet', 'common', { maxHp: 2 }),
    chest: createEquipmentItem('chainmail', 'Кольчуга', 'chest', 'common', { str: 1 }),
    shield: createEquipmentItem('wooden_shield', 'Деревянный щит', 'shield', 'common', { agi: 1 }),
    hands: createEquipmentItem('leather_gloves', 'Кожаные перчатки', 'hands', 'common', { agi: 1 }),
    armor: createEquipmentItem('plate_armor', 'Пластинчатый доспех', 'armor', 'rare', { str: 2, maxHp: 1 }),
    boots: createEquipmentItem('leather_boots', 'Кожаные ботинки', 'boots', 'common', { agi: 1 }),
    cloak: null,
    ring: null
  };
}

function createEquipmentInventory() {
  return [
    createEquipmentItem('dark_cloak', 'Плащ тьмы', 'cloak', 'epic', { int: 2, maxHp: 4 }),
    createEquipmentItem('ring_of_power', 'Кольцо силы', 'ring', 'legendary', { str: 3, maxHp: 2 }),
    createEquipmentItem('iron_gauntlets', 'Железные перчатки', 'hands', 'rare', { str: 1, agi: 1 }),
    createEquipmentItem('travel_boots', 'Сапоги странника', 'boots', 'epic', { agi: 2, maxHp: 2 })
  ];
}

function getEquipmentBonuses(equipment = {}) {
  const bonuses = {
    str: 0,
    agi: 0,
    int: 0,
    maxHp: 0,
    armor: 0,
    attack: 0,
    defense: 0,
    healthRegen: 0,
    resistances: { physical: 0, magic: 0, poison: 0 }
  };
  for (const slot of EQUIPMENT_SLOTS) {
    const item = equipment[slot];
    if (!item) continue;
    const stats = item.statBonus || {};
    for (const stat of ['agi', 'int', 'maxHp', 'attack', 'defense', 'healthRegen']) {
      bonuses[stat] += Number(stats[stat]) || 0;
    }
    bonuses.str += getEnhancedStat(stats.str, item.enhancement);
    const shopItem = SHOP_EQUIPMENT.find((template) =>
      item.name === template.name || item.id === template.id || item.id?.startsWith(`${template.id}_`)
    );
    const baseArmor = Object.hasOwn(stats, 'armor')
      ? Number(stats.armor) || 0
      : shopItem?.statBonus.armor ?? LEGACY_SLOT_ARMOR[slot] ?? 0;
    bonuses.armor += getEnhancedStat(baseArmor, item.enhancement);
    for (const type of DAMAGE_TYPES) {
      bonuses.resistances[type] += Number(stats.resistances?.[type]) || 0;
    }
  }
  return bonuses;
}

function withEquipmentBonuses(character) {
  if (!character) return character;
  const bonuses = getEquipmentBonuses(character.equipment);
  const potionBonuses = getActivePotionBonuses(character);
  const talents = getTalentBonuses(character.talents);
  const maxHp = character.maxHp + bonuses.maxHp;
  const resistances = normalizeResistances(Object.fromEntries(DAMAGE_TYPES.map((type) => [
    type,
    (Number(character.resistances?.[type]) || 0) + bonuses.resistances[type] + talents.resistances[type]
  ])));
  return {
    ...character,
    str: character.str + bonuses.str + potionBonuses.str + talents.attack,
    agi: character.agi + bonuses.agi,
    int: character.int + bonuses.int,
    armor: bonuses.armor + potionBonuses.armor,
    attack: bonuses.attack + talents.attack,
    defense: bonuses.defense,
    healthRegen: bonuses.healthRegen + talents.healthRegen,
    critChance: 0.1 + talents.critChance,
    dodgeChance: 0.05 + talents.dodgeChance,
    blockChance: 0.1 + talents.blockChance,
    resistances,
    talentBonuses: talents,
    maxHp,
    hp: Math.min(character.hp, maxHp),
    equipmentBonuses: bonuses
  };
}

function getActivePotionBonuses(character) {
  const now = Date.now();
  character.potionEffects = (character.potionEffects || []).filter((effect) => effect.expiresAt > now);
  return character.potionEffects.reduce((bonuses, effect) => {
    if (effect.type === 'strength') bonuses.str += Number(effect.value) || 0;
    if (effect.type === 'armor') bonuses.armor += Number(effect.value) || 0;
    return bonuses;
  }, { str: 0, armor: 0 });
}

function sanitizeInventory(inventory = []) {
  return inventory
    .filter((item) => item?.id !== 'food' && item?.name !== 'Пирожок')
    .map((item) => item?.id === 'potion'
      ? { ...item, id: 'potion_health', name: POTIONS.potion_health.name, heal: 50 }
      : item)
    .map((item) => item?.slot
      ? { ...item, rarity: ['common', 'rare', 'epic', 'legendary'].includes(item.rarity) ? item.rarity : 'common' }
      : item);
}

function hasLegacyInventoryItems(row) {
  const inventory = Array.isArray(row.inventory)
    ? row.inventory
    : (typeof row.inventory === 'string' ? JSON.parse(row.inventory || '[]') : []);
  return inventory.some((item) => item?.id === 'food' || item?.id === 'potion' || item?.name === 'Пирожок');
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createEquipmentDrop(rarity) {
  const template = EQUIPMENT_DROP_TEMPLATES[randInt(0, EQUIPMENT_DROP_TEMPLATES.length - 1)];
  const stats = ['str', 'agi', 'int', 'maxHp'];
  const statBonus = { str: 0, agi: 0, int: 0, maxHp: 0, armor: LEGACY_SLOT_ARMOR[template.slot] || 0 };
  const bonusCount = randInt(1, 2);

  for (let i = 0; i < bonusCount; i += 1) {
    const availableStats = stats.filter((stat) => statBonus[stat] === 0);
    const stat = availableStats[randInt(0, availableStats.length - 1)];
    statBonus[stat] = rarity === 'rare' ? randInt(2, 4) : randInt(1, 2);
  }

  const prefix = ITEM_PREFIXES[randInt(0, ITEM_PREFIXES.length - 1)];
  const suffix = ITEM_SUFFIXES[randInt(0, ITEM_SUFFIXES.length - 1)];
  Object.entries(prefix.statBonus).forEach(([stat, value]) => {
    statBonus[stat] = (Number(statBonus[stat]) || 0) + value;
  });
  Object.entries(suffix.statBonus).forEach(([stat, value]) => {
    statBonus[stat] = (Number(statBonus[stat]) || 0) + value;
  });

  return createEquipmentItem(
    `${template.slot}_${uid()}`,
    `${prefix.name} ${template.name} ${suffix.name}`,
    template.slot,
    rarity,
    statBonus
  );
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

const DAILY_QUEST_TEMPLATES = [
  {
    type: 'defeat_enemies',
    name: 'Победить 5 врагов',
    description: 'Победи 5 врагов в бою',
    required: 5,
    reward: { experience: 100, gold: 300 }
  },
  {
    type: 'defeat_boss',
    name: 'Победить босса',
    description: 'Победи 1 босса',
    required: 1,
    reward: { experience: 200, gold: 500 }
  },
  {
    type: 'loot_items',
    name: 'Собрать 3 предмета',
    description: 'Получи 3 предмета в боях',
    required: 3,
    reward: { experience: 150, gold: 400 }
  },
  {
    type: 'visit_cave',
    name: 'Посетить Пещеру',
    description: 'Посети Пещеру и победи там врага',
    required: 1,
    reward: { experience: 100, gold: 200 }
  },
  {
    type: 'purchase_items',
    name: 'Купить 2 предмета',
    description: 'Купи 2 предмета в магазине',
    required: 2,
    reward: { experience: 50, gold: 150 }
  }
];

function getUtcDateKey(timestamp = Date.now()) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function generateRandomQuests() {
  const quests = DAILY_QUEST_TEMPLATES.map((quest) => ({ ...quest }));
  for (let index = quests.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [quests[index], quests[randomIndex]] = [quests[randomIndex], quests[index]];
  }
  return quests.map((quest) => ({
      ...quest,
      id: `daily_${quest.type}`,
      progress: 0,
      status: 'active'
  }));
}

function updateStreakCount(stats, today) {
  const previousDate = new Date(`${today}T00:00:00.000Z`);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  if (stats.lastQuestCompletedDate !== previousDate.toISOString().slice(0, 10)) {
    stats.streakDays = 0;
  }
}

function initializeDailyQuests(character) {
  const today = getUtcDateKey();
  if (!Array.isArray(character.dailyQuests) || character.dailyQuests.length === 0) {
    character.dailyQuests = generateRandomQuests();
  }
  if (!character.questStats || typeof character.questStats !== 'object') {
    character.questStats = {
      streakDays: 0,
      lastQuestResetTime: Date.parse(`${today}T00:00:00.000Z`),
      totalQuestsCompleted: 0,
      todayEnemiesDefeated: 0,
      todayBossesDefeated: 0,
      todayItemsLooted: 0,
      visitedCaveToday: false,
      todayItemsPurchased: 0,
      lastQuestCompletedDate: null
    };
    return;
  }

  const stats = character.questStats;
  if (getUtcDateKey(stats.lastQuestResetTime || 0) !== today) {
    updateStreakCount(stats, today);
    character.dailyQuests = generateRandomQuests();
    Object.assign(stats, {
      lastQuestResetTime: Date.parse(`${today}T00:00:00.000Z`),
      todayEnemiesDefeated: 0,
      todayBossesDefeated: 0,
      todayItemsLooted: 0,
      visitedCaveToday: false,
      todayItemsPurchased: 0
    });
  }
  stats.streakDays = Number(stats.streakDays) || 0;
  stats.totalQuestsCompleted = Number(stats.totalQuestsCompleted) || 0;
}

function calculateQuestProgress(quest, stats) {
  const progressByType = {
    defeat_enemies: stats.todayEnemiesDefeated,
    defeat_boss: stats.todayBossesDefeated,
    loot_items: stats.todayItemsLooted,
    visit_cave: stats.visitedCaveToday ? 1 : 0,
    purchase_items: stats.todayItemsPurchased
  };
  return Math.min(quest.required, Number(progressByType[quest.type]) || 0);
}

function updateDailyQuestProgress(character) {
  initializeDailyQuests(character);
  character.dailyQuests.forEach((quest) => {
    quest.progress = calculateQuestProgress(quest, character.questStats);
  });
}

function addDailyQuestProgress(character, eventType, amount = 1) {
  initializeDailyQuests(character);
  const statByEvent = {
    defeat_enemies: 'todayEnemiesDefeated',
    defeat_boss: 'todayBossesDefeated',
    loot_items: 'todayItemsLooted',
    purchase_items: 'todayItemsPurchased'
  };
  if (eventType === 'visit_cave') character.questStats.visitedCaveToday = true;
  else if (statByEvent[eventType]) character.questStats[statByEvent[eventType]] += amount;
  updateDailyQuestProgress(character);
}

function awardDailyQuestReward(character, quest) {
  character.xp += quest.reward.experience;
  character.gold = creditGold(character.gold, quest.reward.gold);
  const equipmentBonuses = getEquipmentBonuses(character.equipment);
  while (character.xp >= character.xpToNext) {
    character.xp -= character.xpToNext;
    character.level += 1;
    character.talentPoints = (Number(character.talentPoints) || 0) + 1;
    character.str += 1;
    character.agi += 1;
    character.int += 1;
    character.maxHp += 5;
    character.hp = character.maxHp + equipmentBonuses.maxHp;
    character.xpToNext = Math.round(character.xpToNext * 1.4);
  }
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
    talents: {},
    talentPoints: 0,
    resistances: { physical: 0, magic: 0, poison: 0 },
    mana: 100,
    maxMana: 100,
    location: 'town',
    kills: 0,
    inventory: [
      { id: 'potion_health', name: POTIONS.potion_health.name, qty: 2, heal: 50 },
      ...createEquipmentInventory()
    ],
    equipment: createDefaultEquipment(),
    potionEffects: [],
    quests: createDefaultQuests(),
    dailyQuests: [],
    questStats: null,
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
    talents: JSON.stringify(character.talents || {}),
    talentPoints: Math.max(0, Math.floor(Number(character.talentPoints) || 0)),
    resistances: JSON.stringify(normalizeResistances(character.resistances)),
    mana: character.mana ?? 100,
    maxMana: character.maxMana ?? 100,
    location: character.location,
    kills: character.kills,
    inventory: JSON.stringify(sanitizeInventory(character.inventory)),
    equipment: JSON.stringify(character.equipment || createDefaultEquipment()),
    potionEffects: JSON.stringify(character.potionEffects || []),
    quests: JSON.stringify(character.quests || []),
    dailyquests: JSON.stringify(character.dailyQuests || []),
    queststats: JSON.stringify(character.questStats || null),
    passwordHash: character.passwordHash || null,
    createdAt: character.createdAt || Date.now()
  };
}

function deserializeCharacter(row) {
  if (!row) return null;

  const parseObject = (value, fallback) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
      } catch {
        return fallback;
      }
    }
    return fallback;
  };

  const inventory = sanitizeInventory(Array.isArray(row.inventory)
    ? row.inventory
    : (typeof row.inventory === 'string' ? JSON.parse(row.inventory || '[]') : []));

  const quests = Array.isArray(row.quests)
    ? row.quests
    : (typeof row.quests === 'string' ? JSON.parse(row.quests || JSON.stringify(createDefaultQuests())) : createDefaultQuests());
  const dailyQuests = Array.isArray(row.dailyquests)
    ? row.dailyquests
    : (typeof row.dailyquests === 'string' ? JSON.parse(row.dailyquests || '[]') : []);
  let questStats = row.queststats;
  if (typeof questStats === 'string') {
    try {
      questStats = JSON.parse(questStats || 'null');
    } catch {
      questStats = null;
    }
  }

  let equipment = row.equipment;
  if (typeof equipment === 'string') {
    try {
      equipment = JSON.parse(equipment || '{}');
    } catch {
      equipment = {};
    }
  }
  if (!equipment || typeof equipment !== 'object' || Array.isArray(equipment)) equipment = {};
  for (const slot of EQUIPMENT_SLOTS) {
    if (!(slot in equipment)) equipment[slot] = null;
    if (equipment[slot]) {
      equipment[slot].enhancement = normalizeEnhancementLevel(equipment[slot].enhancement);
      equipment[slot].rarity = ['common', 'rare', 'epic', 'legendary'].includes(equipment[slot].rarity)
        ? equipment[slot].rarity
        : 'common';
    }
  }
  let potionEffects = row.potioneffects;
  if (typeof potionEffects === 'string') {
    try {
      potionEffects = JSON.parse(potionEffects || '[]');
    } catch {
      potionEffects = [];
    }
  }

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
    gold: normalizeGold(row.gold),
    talents: parseObject(row.talents, {}),
    talentPoints: Math.max(0, Math.floor(Number(row.talentpoints ?? row.talentPoints) || 0)),
    resistances: normalizeResistances(parseObject(row.resistances, {})),
    mana: row.mana ?? 100,
    maxMana: row.maxmana ?? 100,
    location: row.location,
    kills: row.kills,
    inventory,
    equipment,
    potionEffects: Array.isArray(potionEffects) ? potionEffects : [],
    quests,
    dailyQuests,
    questStats,
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
    'talents TEXT DEFAULT \'{}\'',
    'talentpoints INTEGER DEFAULT 0',
    'resistances TEXT DEFAULT \'{}\'',
    'mana INTEGER DEFAULT 100',
    'maxmana INTEGER DEFAULT 100',
    'location TEXT',
    'kills INTEGER',
    'inventory TEXT',
    'equipment TEXT',
    "potioneffects TEXT DEFAULT '[]'",
    'quests TEXT',
    'dailyquests TEXT',
    'queststats TEXT',
    'passwordhash TEXT',
    'createdat BIGINT'
  ];

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
      talents TEXT DEFAULT '{}',
      talentpoints INTEGER DEFAULT 0,
      resistances TEXT DEFAULT '{}',
      mana INTEGER DEFAULT 100,
      maxmana INTEGER DEFAULT 100,
      location TEXT,
      kills INTEGER,
      inventory TEXT,
      equipment TEXT,
      potioneffects TEXT DEFAULT '[]',
      quests TEXT,
      dailyquests TEXT,
      queststats TEXT,
      passwordhash TEXT,
      createdat BIGINT
    )
  `;

  await pool.query(createTableSql);

  const columns = await pool.query(`
    SELECT lower(column_name) AS column_name
    FROM information_schema.columns
    WHERE table_name = 'characters'
  `);
  const present = new Set(columns.rows.map((r) => r.column_name));

  for (const colDef of needed) {
    const [columnName, ...typeParts] = colDef.split(' ');
    const columnType = typeParts.join(' ');
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
      id, name, classid, faction, level, xp, xptonext, maxhp, hp, str, agi, int, gold, talents, talentpoints, resistances, mana, maxmana, location, kills, inventory, equipment, potioneffects, quests, dailyquests, queststats, passwordhash, createdat
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
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
      talents = EXCLUDED.talents,
      talentpoints = EXCLUDED.talentpoints,
      resistances = EXCLUDED.resistances,
      mana = EXCLUDED.mana,
      maxmana = EXCLUDED.maxmana,
      location = EXCLUDED.location,
      kills = EXCLUDED.kills,
      inventory = EXCLUDED.inventory,
      equipment = EXCLUDED.equipment,
      potioneffects = EXCLUDED.potioneffects,
      quests = EXCLUDED.quests,
      dailyquests = EXCLUDED.dailyquests,
      queststats = EXCLUDED.queststats,
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
      row.talents,
      row.talentPoints,
      row.resistances,
      row.mana,
      row.maxMana,
      row.location,
      row.kills,
      row.inventory,
      row.equipment,
      row.potionEffects,
      row.quests,
      row.dailyquests,
      row.queststats,
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
  const row = result.rows[0];
  const character = deserializeCharacter(row);
  if (character && hasLegacyInventoryItems(row)) await saveCharacter(character);
  return character;
}

async function loadCharacterByName(name) {
  const result = await pool.query('SELECT * FROM characters WHERE name = $1', [name]);
  const row = result.rows[0];
  const character = deserializeCharacter(row);
  if (character && hasLegacyInventoryItems(row)) await saveCharacter(character);
  return character;
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
    locations: LOCATIONS,
    monsters: MONSTERS
  });
});

app.get('/api/locations', (req, res) => {
  res.json(LOCATIONS);
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
  res.json({ character: stripPassword(withEquipmentBonuses(character)), notice: 'Советуем придумать пароль к 10 уровню и не хранить его в открытом виде.' });
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

  res.json({ character: stripPassword(withEquipmentBonuses(stored)) });
});

app.get('/api/character', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Нужно id персонажа.' });

  const char = await loadCharacterById(id);
  if (!char) return res.status(404).json({ error: 'Персонаж не найден.' });

  initializeDailyQuests(char);
  updateQuests(char);
  await saveCharacter(char);
  res.json({ character: stripPassword(withEquipmentBonuses(char)) });
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
  const loc = LOCATIONS.find((location) => location.id === to);

  if (!char || !loc) return res.status(400).json({ error: 'Неверные данные для перемещения.' });

  char.location = to;
  await saveCharacter(char);
  res.json({ location: loc, character: stripPassword(withEquipmentBonuses(char)) });
});

app.post('/api/fight', async (req, res) => {
  const { id } = req.body;
  let char = await loadCharacterById(id);
  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });

  const loc = LOCATIONS.find((location) => location.id === char.location);

  if (!loc || !loc.monsters || loc.monsters.length === 0) {
    return res.json({ message: 'Здесь нет врагов.', character: stripPassword(withEquipmentBonuses(char)) });
  }

  const monsterId = loc.monsters[randInt(0, loc.monsters.length - 1)];
  const monster = { ...MONSTERS[monsterId] };
  const log = [];
  const equipmentBonuses = getEquipmentBonuses(char.equipment);
  const potionBonuses = getActivePotionBonuses(char);
  const combatCharacter = withEquipmentBonuses(char);
  const effectiveMaxHp = combatCharacter.maxHp;
  const attackType = char.classId === 'mage' ? 'magic' : char.classId === 'rogue' ? 'poison' : 'physical';

  while (char.hp > 0 && monster.hp > 0) {
    const baseStat = char.classId === 'mage' ? char.int + equipmentBonuses.int : char.str + equipmentBonuses.str;
    const playerHit = resolveCombatHit({
        baseDamage: randInt(1, 6) + baseStat + equipmentBonuses.attack + combatCharacter.talentBonuses.attack + potionBonuses.str + Math.floor(char.level / 2),
      damageType: attackType,
      defense: monster.def,
      resistances: monster.resistances,
      critChance: combatCharacter.critChance,
      rng: Math.random
    });
    monster.hp = Math.max(0, monster.hp - playerHit.damage);
    log.push(playerHit.dodged
      ? `${monster.name} уклонился от вашей атаки.`
      : `${char.name} наносит ${playerHit.damage} ${attackType} урона ${monster.name}${playerHit.critical ? ' критическим ударом' : ''}.`);

    if (monster.hp <= 0) break;

    const baseMonsterDamage = Math.max(1, monster.atk + randInt(0, 3) - Math.floor((char.agi + equipmentBonuses.agi) / 3));
    const monsterHit = resolveCombatHit({
      baseDamage: baseMonsterDamage,
      damageType: monster.damageType || 'physical',
      defense: equipmentBonuses.defense,
      armor: equipmentBonuses.armor + potionBonuses.armor,
      resistances: combatCharacter.resistances,
      dodgeChance: combatCharacter.dodgeChance,
      blockChance: combatCharacter.blockChance,
      rng: Math.random
    });
    char.hp = Math.max(0, char.hp - monsterHit.damage);
    log.push(monsterHit.dodged
      ? `Вы уклонились от атаки ${monster.name}.`
      : `${monster.name} наносит ${monsterHit.damage} ${monsterHit.damageType} урона${monsterHit.blocked ? ' (блок)' : ''} ${char.name}.`);
    if (char.hp > 0) char.hp = Math.min(effectiveMaxHp, char.hp + combatCharacter.healthRegen);
  }

  if (char.hp > 0) {
    char.kills += 1;
    addDailyQuestProgress(char, 'defeat_enemies');
    if (char.location === 'cave') addDailyQuestProgress(char, 'visit_cave');
    char.xp += monster.xp;
    char.gold = creditGold(char.gold, monster.gold);
    log.push(`${char.name} победил(а) ${monster.name}! Получено ${monster.xp} XP и ${monster.gold} золота.`);

    while (char.xp >= char.xpToNext) {
      char.xp -= char.xpToNext;
      char.level += 1;
      char.talentPoints = (Number(char.talentPoints) || 0) + 1;
      char.str += 1;
      char.agi += 1;
      char.int += 1;
      char.maxHp += 5;
      char.hp = char.maxHp + equipmentBonuses.maxHp;
      char.xpToNext = Math.round(char.xpToNext * 1.4);
      log.push(`${char.name} достиг(ла) уровня ${char.level}!`);
    }

    if (Math.random() < 0.6) {
      const loot = { id: 'potion_health', name: POTIONS.potion_health.name, effect: POTIONS.potion_health.effect, qty: 1 };
      const existing = char.inventory.find((item) => item.id === loot.id);
      if (existing) {
        existing.qty += loot.qty;
      } else {
        char.inventory.push(loot);
        addDailyQuestProgress(char, 'loot_items');
      }
      log.push(`Найден предмет: ${loot.name} x${loot.qty}`);
      addDailyQuestProgress(char, 'loot_items');
    }

    const equipmentDropChance = monster.rarity === 'rare' ? 0.03 : 0.2;
    if (Math.random() < equipmentDropChance) {
      const loot = createEquipmentDrop(monster.rarity === 'rare' ? 'rare' : 'common');
      char.inventory.push(loot);
      log.push(`Найдено снаряжение: ${loot.name} (${loot.slot}), бонусы: ${Object.entries(loot.statBonus)
        .filter(([, value]) => value > 0)
        .map(([stat, value]) => `${stat} +${value}`)
        .join(', ')}.`);
    }

    updateQuests(char);
    if (char.quests.every((q) => q.done)) {
      const bonusGold = 50;
      char.gold = creditGold(char.gold, bonusGold);
      log.push(`Все квесты выполнены! Получено ${bonusGold} золота в награду.`);
    }

    await saveCharacter(char);
    return res.json({ victory: true, log, character: stripPassword(withEquipmentBonuses(char)) });
  }

  char.hp = Math.max(1, Math.floor(effectiveMaxHp / 2));
  char.gold = normalizeGold(char.gold - Math.floor(normalizeGold(char.gold) * 0.1));
  char.location = 'town';
  log.push(`${char.name} был(а) побежден(а), отступил(а) в город и потерял(а) часть золота.`);

  await saveCharacter(char);
  res.json({ victory: false, log, character: stripPassword(withEquipmentBonuses(char)) });
});

const FOREST_ENEMIES = [
  { name: 'Гоблин', hp: 14, atk: 4, def: 1, xp: 10, gold: 7 },
  { name: 'Орк', hp: 22, atk: 6, def: 2, xp: 16, gold: 12 },
  { name: 'Волк', hp: 18, atk: 5, def: 1, xp: 15, gold: 10 },
  { name: 'Тролль', hp: 28, atk: 7, def: 2, xp: 20, gold: 15, damageType: 'physical' }
];

const CAVE_ENEMIES = [
  { name: 'Пещерный Паук', hp: 24, atk: 7, def: 2, xp: 20, gold: 14, damageType: 'poison' },
  { name: 'Минотавр', hp: 36, atk: 9, def: 3, xp: 30, gold: 22 },
  { name: 'Каменный Голем', hp: 44, atk: 8, def: 5, xp: 34, gold: 26, damageType: 'magic', resistances: { physical: 15 } }
];

const BOSS_TEMPLATE = { name: 'Король Гоблинов', hp: 60, atk: 10, def: 3, xp: 120, gold: 150, resistances: { poison: 10 } };
const FIGHT_LOCATIONS = ['forest', 'cave'];
const fightSessions = new Map();

function createEnemies(location, level) {
  const pool = location === 'cave' ? CAVE_ENEMIES : FOREST_ENEMIES;
  const count = location === 'cave' ? 3 : 1;
  const enemies = [];
  for (let i = 0; i < count; i += 1) {
    const tpl = pool[randInt(0, pool.length - 1)];
    enemies.push({ id: `e${i + 1}`, ...tpl, maxHp: tpl.hp, isBoss: false });
  }
  return enemies;
}

function createBoss(level) {
  const hp = BOSS_TEMPLATE.hp + level * 20;
  return {
    id: 'boss',
    ...BOSS_TEMPLATE,
    hp,
    maxHp: hp,
    atk: BOSS_TEMPLATE.atk + level * 2,
    def: BOSS_TEMPLATE.def + Math.floor(level / 2),
    isBoss: true
  };
}

function describeBonuses(item) {
  const bonuses = Object.entries(item.statBonus)
    .filter(([key, value]) => key !== 'resistances' && Number(value) > 0)
    .map(([key, value]) => `${key} +${value}`);
  Object.entries(item.statBonus.resistances || {}).forEach(([type, value]) => {
    if (Number(value) > 0) bonuses.push(`${type} resistance +${value}%`);
  });
  return bonuses.join(', ');
}

function grantReward(char, reward, log, { equipmentChance, equipmentRarity }) {
  char.xp += reward.xp;
  char.gold = creditGold(char.gold, reward.gold);
  log.push(`Получено ${reward.xp} XP и ${reward.gold} золота.`);

  const bonuses = getEquipmentBonuses(char.equipment);
  while (char.xp >= char.xpToNext) {
    char.xp -= char.xpToNext;
    char.level += 1;
    char.talentPoints = (Number(char.talentPoints) || 0) + 1;
    char.str += 1;
    char.agi += 1;
    char.int += 1;
    char.maxHp += 5;
    char.hp = char.maxHp + bonuses.maxHp;
    char.xpToNext = Math.round(char.xpToNext * 1.4);
    log.push(`${char.name} достиг(ла) уровня ${char.level}!`);
  }

  if (Math.random() < equipmentChance) {
    const loot = createEquipmentDrop(equipmentRarity);
    char.inventory.push(loot);
    addDailyQuestProgress(char, 'loot_items');
    log.push(`Найдено снаряжение: ${loot.name} (${loot.slot}), бонусы: ${describeBonuses(loot)}.`);
  }
}

function fightPayload(char, session, log) {
  return {
    location: session.location,
    phase: session.phase,
    enemies: session.enemies,
    log,
    character: stripPassword(withEquipmentBonuses(char))
  };
}

async function loadFightContext(req, res, source) {
  const { id, location } = source;
  if (!id) {
    res.status(400).json({ error: 'Нужно id персонажа.' });
    return null;
  }
  const char = await loadCharacterById(id);
  if (!char) {
    res.status(404).json({ error: 'Персонаж не найден.' });
    return null;
  }
  return { char, location };
}

app.get('/api/fight', async (req, res) => {
  const { location, action } = req.query;
  if (!FIGHT_LOCATIONS.includes(location)) return res.status(400).json({ error: 'Неизвестная локация.' });
  if (action !== 'start') return res.status(400).json({ error: 'Неизвестное действие.' });

  const ctx = await loadFightContext(req, res, req.query);
  if (!ctx) return;
  const { char } = ctx;

  const session = { location, phase: 'fight', enemies: createEnemies(location, char.level) };
  fightSessions.set(char.id, session);
  char.location = location;
  await saveCharacter(char);

  const names = session.enemies.map((e) => e.name).join(', ');
  res.json(fightPayload(char, session, [`Вы встретили: ${names}.`]));
});

app.post('/api/fight/boss', async (req, res) => {
  const ctx = await loadFightContext(req, res, req.body);
  if (!ctx) return;
  const session = fightSessions.get(ctx.char.id);
  if (!session || session.location !== 'cave' || session.phase !== 'group_cleared') {
    return res.status(400).json({ error: 'Босс недоступен.' });
  }
  session.phase = 'boss';
  session.enemies = [createBoss(ctx.char.level)];
  res.json(fightPayload(ctx.char, session, [`Перед вами ${session.enemies[0].name}!`]));
});

app.post('/api/fight/attack', async (req, res) => {
  const ctx = await loadFightContext(req, res, req.body);
  if (!ctx) return;
  const { char } = ctx;
  const session = fightSessions.get(char.id);
  if (!session || session.location !== ctx.location || !['fight', 'boss'].includes(session.phase)) {
    return res.status(400).json({ error: 'Нет активного боя.' });
  }

  const alive = session.enemies.filter((e) => e.hp > 0);
  const target = alive.find((e) => e.id === req.body.targetId) || alive[0];
  const bonuses = getEquipmentBonuses(char.equipment);
  const potionBonuses = getActivePotionBonuses(char);
  const combatCharacter = withEquipmentBonuses(char);
  const log = [];

  const attackType = char.classId === 'mage' ? 'magic' : char.classId === 'rogue' ? 'poison' : 'physical';
  const baseStat = char.classId === 'mage' ? char.int + bonuses.int : char.str + bonuses.str;
  const playerHit = resolveCombatHit({
    baseDamage: randInt(1, 6) + baseStat + bonuses.attack + combatCharacter.talentBonuses.attack + potionBonuses.str + Math.floor(char.level / 2),
    damageType: attackType,
    defense: target.def,
    armor: target.armor,
    resistances: target.resistances,
    critChance: combatCharacter.critChance,
    rng: Math.random
  });
  target.hp = Math.max(0, target.hp - playerHit.damage);
  log.push(playerHit.dodged
    ? `${target.name} уклонился от вашей атаки.`
    : `Вы атаковали ${target.name} на ${playerHit.damage} ${attackType} урона${playerHit.critical ? ' критическим ударом' : ''}.`);

  if (target.hp <= 0) {
    log.push(target.isBoss ? 'Босс повержен!' : 'Враг повержен!');
    if (!target.isBoss) {
      char.kills += 1;
      addDailyQuestProgress(char, 'defeat_enemies');
      if (session.location === 'cave') addDailyQuestProgress(char, 'visit_cave');
      grantReward(char, target, log, { equipmentChance: session.location === 'cave' ? 0.3 : 0.2, equipmentRarity: 'common' });
      updateQuests(char);
    }
  }

  for (const enemy of session.enemies.filter((e) => e.hp > 0)) {
    const baseDamage = enemy.atk + randInt(0, 3) - Math.floor((char.agi + bonuses.agi) / 3);
    const hit = resolveCombatHit({
      baseDamage,
      damageType: enemy.damageType || 'physical',
      defense: bonuses.defense,
      armor: bonuses.armor + potionBonuses.armor,
      resistances: combatCharacter.resistances,
      dodgeChance: combatCharacter.dodgeChance,
      blockChance: combatCharacter.blockChance,
      rng: Math.random
    });
    char.hp = Math.max(0, char.hp - hit.damage);
    log.push(hit.dodged
      ? `Вы уклонились от атаки ${enemy.name}.`
      : `${enemy.name} атаковал вас на ${hit.damage} ${hit.damageType} урона${hit.blocked ? ' (блок)' : ''}.`);
    if (char.hp <= 0) break;
  }

  if (char.hp > 0) char.hp = Math.min(combatCharacter.maxHp, char.hp + combatCharacter.healthRegen);

  if (char.hp <= 0) {
    session.phase = 'defeated';
    log.push('Вы повержены!');
  } else if (session.enemies.every((e) => e.hp <= 0)) {
    if (session.location === 'forest') session.phase = 'cleared';
    else session.phase = session.enemies[0].isBoss ? 'boss_cleared' : 'group_cleared';
  }

  await saveCharacter(char);
  res.json(fightPayload(char, session, log));
});

app.post('/api/fight/flee', async (req, res) => {
  const ctx = await loadFightContext(req, res, req.body);
  if (!ctx) return;
  const { char } = ctx;
  fightSessions.delete(char.id);
  if (char.hp <= 0) char.hp = 1;
  char.location = 'town';
  await saveCharacter(char);
  res.json({ fled: true, character: stripPassword(withEquipmentBonuses(char)) });
});

app.post('/api/fight/defeat', async (req, res) => {
  const ctx = await loadFightContext(req, res, req.body);
  if (!ctx) return;
  const { char } = ctx;
  const session = fightSessions.get(char.id);
  if (!session || session.phase !== 'defeated') return res.status(400).json({ error: 'Вы не повержены.' });

  const maxHp = char.maxHp + getEquipmentBonuses(char.equipment).maxHp;
  char.hp = Math.max(1, Math.floor(maxHp / 2));
  char.location = 'town';
  fightSessions.delete(char.id);
  await saveCharacter(char);
  res.json({ restored: true, character: stripPassword(withEquipmentBonuses(char)) });
});

app.post('/api/fight/bosses/defeat', async (req, res) => {
  const ctx = await loadFightContext(req, res, req.body);
  if (!ctx) return;
  const { char } = ctx;
  const session = fightSessions.get(char.id);
  if (!session || session.phase !== 'boss_cleared') return res.status(400).json({ error: 'Награда недоступна.' });

  const boss = session.enemies[0];
  const log = ['Босс повержен! Вы победили пещеру!'];
  char.kills += 1;
  addDailyQuestProgress(char, 'defeat_boss');
  grantReward(char, boss, log, { equipmentChance: 1, equipmentRarity: 'rare' });
  updateQuests(char);
  char.location = 'town';
  fightSessions.delete(char.id);
  await saveCharacter(char);
  res.json({ log, character: stripPassword(withEquipmentBonuses(char)) });
});

const PAGES = {
  '/city': 'city.html',
  '/forest': 'forest.html',
  '/cave': 'cave.html',
  '/character': 'character.html',
  '/hero-stats': 'hero-stats.html',
  '/quests': 'quests.html',
  '/talents': 'talents.html',
  '/fight': 'fight.html',
  '/inventory': 'inventory.html',
  '/equipment': 'equipment.html',
  '/enhancement': 'enhancement.html',
  '/shop': 'shop.html',
  '/towers-map': 'towers-map.html',
  '/faction-war': 'faction-war.html'
};
for (const [route, file] of Object.entries(PAGES)) {
  app.get(route, (req, res) => res.sendFile(path.join(__dirname, 'public', file)));
}

app.get('/api/talents', async (req, res) => {
  if (!req.query.id) return res.status(400).json({ error: 'Нужно id персонажа.' });
  const char = await loadCharacterById(req.query.id);
  if (!char) return res.status(404).json({ error: 'Персонаж не найден.' });
  res.json({
    talents: char.talents,
    talentPoints: char.talentPoints,
    trees: TALENT_TREES,
    bonuses: getTalentBonuses(char.talents)
  });
});

app.post('/api/talents/upgrade', async (req, res) => {
  if (!req.body.id) return res.status(400).json({ error: 'Нужно id персонажа.' });
  const char = await loadCharacterById(req.body.id);
  if (!char) return res.status(404).json({ error: 'Персонаж не найден.' });
  try {
    const upgraded = upgradeTalent(char.talents, char.talentPoints, req.body.talentId);
    char.talents = upgraded.talents;
    char.talentPoints = upgraded.talentPoints;
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  await saveCharacter(char);
  res.json({
    character: stripPassword(withEquipmentBonuses(char)),
    talents: char.talents,
    talentPoints: char.talentPoints,
    bonuses: getTalentBonuses(char.talents)
  });
});

app.get('/api/equipment', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Нужно id персонажа.' });
  const char = await loadCharacterById(id);
  if (!char) return res.status(404).json({ error: 'Персонаж не найден.' });
  res.json({
    equipment: char.equipment,
    inventory: char.inventory.filter((item) => item.slot && EQUIPMENT_SLOTS.includes(item.slot)),
    bonuses: getEquipmentBonuses(char.equipment)
  });
});

app.post('/api/equipItem', async (req, res) => {
  const { id, slot, itemId } = req.body;
  if (!id || !itemId || !EQUIPMENT_SLOTS.includes(slot)) {
    return res.status(400).json({ error: 'Неверный персонаж или слот снаряжения.' });
  }

  const char = await loadCharacterById(id);
  if (!char) return res.status(404).json({ error: 'Персонаж не найден.' });

  const inventoryIndex = char.inventory.findIndex((item) => item.id === itemId && item.slot === slot);
  if (inventoryIndex < 0) return res.status(400).json({ error: 'Предмет не найден в инвентаре или не подходит для этого слота.' });
  const currentItem = char.equipment[slot];
  const [nextItem] = char.inventory.splice(inventoryIndex, 1);
  if (currentItem) char.inventory.push(currentItem);
  char.equipment[slot] = nextItem;

  char.hp = Math.min(char.hp, char.maxHp + getEquipmentBonuses(char.equipment).maxHp);
  await saveCharacter(char);
  res.json({
    character: stripPassword(withEquipmentBonuses(char)),
    equipment: char.equipment,
    inventory: char.inventory.filter((item) => item.slot && EQUIPMENT_SLOTS.includes(item.slot)),
    bonuses: getEquipmentBonuses(char.equipment),
    message: `Надеты: ${nextItem.name}.${currentItem ? ` Сняты: ${currentItem.name}.` : ''}`
  });
});

app.post('/api/unequipItem', async (req, res) => {
  const { id, slot } = req.body;
  if (!id || !EQUIPMENT_SLOTS.includes(slot)) {
    return res.status(400).json({ error: 'Неверный персонаж или слот снаряжения.' });
  }

  const char = await loadCharacterById(id);
  if (!char) return res.status(404).json({ error: 'Персонаж не найден.' });

  const item = char.equipment[slot];
  if (!item) return res.status(400).json({ error: 'В этом слоте нет предмета.' });
  char.inventory.push(item);
  char.equipment[slot] = null;
  char.hp = Math.min(char.hp, char.maxHp + getEquipmentBonuses(char.equipment).maxHp);

  await saveCharacter(char);
  res.json({
    character: stripPassword(withEquipmentBonuses(char)),
    equipment: char.equipment,
    inventory: char.inventory.filter((inventoryItem) => inventoryItem.slot && EQUIPMENT_SLOTS.includes(inventoryItem.slot)),
    bonuses: getEquipmentBonuses(char.equipment),
    message: `Снято: ${item.name}. Предмет возвращён в инвентарь.`
  });
});

app.post('/api/enhanceItem', async (req, res) => {
  const { id, slot } = req.body;
  if (!id || !EQUIPMENT_SLOTS.includes(slot)) {
    return res.status(400).json({ error: 'Неверный персонаж или слот снаряжения.' });
  }

  const char = await loadCharacterById(id);
  if (!char) return res.status(404).json({ error: 'Персонаж не найден.' });

  const item = char.equipment[slot];
  if (!item) return res.status(400).json({ error: 'В этом слоте нет предмета.' });
  const enhancement = normalizeEnhancementLevel(item.enhancement);
  if (enhancement >= 10) return res.status(400).json({ error: 'Предмет уже максимально усилен!' });

  const cost = ENHANCEMENT_COSTS[enhancement];
  if (char.gold < cost) {
    return res.status(400).json({ error: `Не хватает золота! Нужно: ${cost}, Есть: ${char.gold}` });
  }

  char.gold = spendGold(char.gold, cost);
  const success = Math.random() * 100 < ENHANCEMENT_CHANCES[enhancement];
  if (success) item.enhancement = enhancement + 1;

  await saveCharacter(char);
  res.json({
    character: stripPassword(withEquipmentBonuses(char)),
    success,
    message: success ? `Усиление успешно! ${item.name} теперь +${item.enhancement}` : 'Усиление не удалось!'
  });
});

app.get('/api/inventory', async (req, res) => {
  const id = req.query.id;
  const char = await loadCharacterById(id);
  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });
  const equippedIds = new Set(Object.values(char.equipment || {}).filter(Boolean).map((item) => item.id));
  res.json({
    inventory: char.inventory.filter((item) => item.slot && EQUIPMENT_SLOTS.includes(item.slot) && !equippedIds.has(item.id))
  });
});

app.post('/api/useItem', async (req, res) => {
  const { id, idx } = req.body;
  const char = await loadCharacterById(id);
  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });

  const item = char.inventory[idx];
  if (!item) return res.status(400).json({ error: 'Предмет не найден.' });

  return res.status(400).json({ error: 'Этот предмет нельзя использовать.' });
});

app.post('/api/usePotion', async (req, res) => {
  const { id, potionId } = req.body;
  const potion = POTIONS[potionId];
  if (!id || !potion) return res.status(400).json({ error: 'Неизвестное зелье.' });
  const char = await loadCharacterById(id);
  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });

  const index = char.inventory.findIndex((item) => item.id === potionId && item.qty > 0);
  if (index < 0) return res.status(400).json({ error: 'Этого зелья нет в инвентаре.' });

  const [item] = char.inventory.splice(index, 1);
  if (item.qty > 1) char.inventory.push({ ...item, qty: item.qty - 1 });
  if (potion.type === 'health') {
    const maxHp = char.maxHp + getEquipmentBonuses(char.equipment).maxHp;
    char.hp = Math.min(maxHp, char.hp + 50);
  } else if (potion.type === 'mana') {
    char.mana = Math.min(char.maxMana, char.mana + 30);
  } else {
    char.potionEffects = (char.potionEffects || []).filter((effect) => effect.expiresAt > Date.now());
    char.potionEffects.push({
      type: potion.type,
      value: potion.type === 'strength' ? 5 : 10,
      expiresAt: Date.now() + 10_000
    });
  }

  await saveCharacter(char);
  res.json({ message: `Использовано: ${potion.name} (${potion.effect}).`, character: stripPassword(withEquipmentBonuses(char)) });
});

app.get('/api/quests', async (req, res) => {
  const id = req.query.id;
  const char = await loadCharacterById(id);
  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });

  updateQuests(char);
  await saveCharacter(char);
  res.json({ quests: char.quests });
});

app.get('/api/daily-quests', async (req, res) => {
  const { id } = req.query;
  const char = await loadCharacterById(id);
  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });
  initializeDailyQuests(char);
  updateDailyQuestProgress(char);
  await saveCharacter(char);
  res.json({
    dailyQuests: char.dailyQuests,
    questStats: char.questStats,
    character: stripPassword(withEquipmentBonuses(char))
  });
});

app.post('/api/daily-quests/complete', async (req, res) => {
  const { id, questId } = req.body;
  const char = await loadCharacterById(id);
  if (!char) return res.status(404).json({ error: 'Персонаж не найден.' });
  initializeDailyQuests(char);
  updateDailyQuestProgress(char);
  const quest = char.dailyQuests.find((candidate) => candidate.id === questId);
  if (!quest || quest.status !== 'active') {
    return res.status(400).json({ error: 'Активный квест не найден.' });
  }
  if (quest.progress < quest.required) {
    return res.status(400).json({ error: 'Квест ещё не выполнен.' });
  }

  quest.status = 'completed';
  awardDailyQuestReward(char, quest);
  const today = getUtcDateKey();
  if (char.questStats.lastQuestCompletedDate !== today) {
    const yesterday = new Date(`${today}T00:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    char.questStats.streakDays = char.questStats.lastQuestCompletedDate === yesterday.toISOString().slice(0, 10)
      ? char.questStats.streakDays + 1
      : 1;
    char.questStats.lastQuestCompletedDate = today;
  }
  char.questStats.totalQuestsCompleted += 1;
  await saveCharacter(char);
  res.json({
    dailyQuests: char.dailyQuests,
    questStats: char.questStats,
    character: stripPassword(withEquipmentBonuses(char))
  });
});

app.post('/api/daily-quests/skip', async (req, res) => {
  const { id, questId } = req.body;
  const char = await loadCharacterById(id);
  if (!char) return res.status(404).json({ error: 'Персонаж не найден.' });
  initializeDailyQuests(char);
  const quest = char.dailyQuests.find((candidate) => candidate.id === questId);
  if (!quest || quest.status !== 'active') {
    return res.status(400).json({ error: 'Активный квест не найден.' });
  }
  quest.status = 'skipped';
  await saveCharacter(char);
  res.json({
    dailyQuests: char.dailyQuests,
    questStats: char.questStats,
    character: stripPassword(withEquipmentBonuses(char))
  });
});

app.post('/api/buyPotion', async (req, res) => {
  const { id } = req.body;
  const char = await loadCharacterById(id);
  if (!char) return res.status(400).json({ error: 'Персонаж не найден.' });
  char.gold = normalizeGold(char.gold);
  if (char.gold < 10) return res.status(400).json({ error: 'Недостаточно золота.' });

  char.gold = spendGold(char.gold, 10);
  const potionId = POTIONS[req.body.potionId] ? req.body.potionId : 'potion_health';
  const existing = char.inventory.find((item) => item.id === potionId);
  if (existing) existing.qty += 1;
  else char.inventory.push({ id: potionId, name: POTIONS[potionId].name, effect: POTIONS[potionId].effect, qty: 1 });

  addDailyQuestProgress(char, 'purchase_items');
  await saveCharacter(char);
  res.json({ message: `Куплено: ${POTIONS[potionId].name}.`, character: stripPassword(withEquipmentBonuses(char)) });
});

app.get('/api/shop', async (req, res) => {
  if (!req.query.id) return res.status(400).json({ error: 'Нужно id персонажа.' });
  const char = await loadCharacterById(req.query.id);
  if (!char) return res.status(404).json({ error: 'Персонаж не найден.' });
  res.json({
    items: SHOP_EQUIPMENT.map((item) => ({ ...item, rarity: 'common', price: SHOP_ITEM_PRICE })),
    inventory: char.inventory.filter((item) => item.slot && EQUIPMENT_SLOTS.includes(item.slot))
      .map((item) => ({ ...item, sellPrice: getSalePrice(item, SHOP_ITEM_PRICE) }))
  });
});

app.post('/api/buyEquipment', async (req, res) => {
  const { id, itemId } = req.body;
  const item = SHOP_EQUIPMENT.find((candidate) => candidate.id === itemId);
  if (!id || !item) return res.status(400).json({ error: 'Неизвестный предмет.' });

  const char = await loadCharacterById(id);
  if (!char) return res.status(404).json({ error: 'Персонаж не найден.' });
  char.gold = normalizeGold(char.gold);
  if (char.gold < SHOP_ITEM_PRICE) return res.status(400).json({ error: 'Недостаточно золота.' });

  char.gold = spendGold(char.gold, SHOP_ITEM_PRICE);
  char.inventory.push(createEquipmentItem(
    `${item.id}_${uid()}`,
    item.name,
    item.slot,
    'common',
    item.statBonus
  ));
  addDailyQuestProgress(char, 'purchase_items');
  await saveCharacter(char);
  res.json({ message: `Куплено: ${item.name}.`, character: stripPassword(withEquipmentBonuses(char)) });
});

app.post('/api/sellItem', async (req, res) => {
  const { id, itemId } = req.body;
  if (!id || !itemId) return res.status(400).json({ error: 'Нужно указать персонажа и предмет.' });
  const char = await loadCharacterById(id);
  if (!char) return res.status(404).json({ error: 'Персонаж не найден.' });
  const index = char.inventory.findIndex((item) => item.id === itemId && item.slot && EQUIPMENT_SLOTS.includes(item.slot));
  if (index < 0) return res.status(400).json({ error: 'Предмет не найден в инвентаре или не может быть продан.' });

  const [item] = char.inventory.splice(index, 1);
  const price = getSalePrice(item, SHOP_ITEM_PRICE);
  char.gold = creditGold(char.gold, price);
  await saveCharacter(char);
  res.json({
    message: `Продано: ${item.name} за ${price} золота.`,
    character: stripPassword(withEquipmentBonuses(char)),
    salePrice: price
  });
});

app.post('/api/buyEquipmentSet', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Нужно id персонажа.' });

  const char = await loadCharacterById(id);
  if (!char) return res.status(404).json({ error: 'Персонаж не найден.' });
  char.gold = normalizeGold(char.gold);
  if (char.gold < SHOP_SET_PRICE) return res.status(400).json({ error: 'Недостаточно золота.' });

  char.gold = spendGold(char.gold, SHOP_SET_PRICE);
  char.inventory.push(...SHOP_EQUIPMENT.map((item) => createEquipmentItem(
    `${item.id}_${uid()}`,
    item.name,
    item.slot,
    'common',
    item.statBonus
  )));
  addDailyQuestProgress(char, 'purchase_items', SHOP_EQUIPMENT.length);
  await saveCharacter(char);
  res.json({ message: 'Куплен полный комплект снаряжения.', character: stripPassword(withEquipmentBonuses(char)) });
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
