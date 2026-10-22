const DAMAGE_TYPES = ['physical', 'magic', 'poison'];
const RESISTANCE_CAP = 75;
const TALENT_TREES = [
  {
    id: 'assault',
    name: 'Натиск',
    talents: [
      { id: 'power', name: 'Сила удара', description: '+1 к атаке за ранг', maxRank: 3 },
      { id: 'precision', name: 'Точность', description: '+3% к шансу критического удара за ранг', maxRank: 3 }
    ]
  },
  {
    id: 'survival',
    name: 'Выживание',
    talents: [
      { id: 'evasion', name: 'Уклонение', description: '+3% к шансу уклонения за ранг', maxRank: 3 },
      { id: 'guard', name: 'Стойка', description: '+5% к шансу блока за ранг', maxRank: 3 }
    ]
  },
  {
    id: 'arcana',
    name: 'Мудрость',
    talents: [
      { id: 'ward', name: 'Защитный знак', description: '+5% сопротивления магии и яду за ранг', maxRank: 3 },
      { id: 'mending', name: 'Восстановление', description: '+1 здоровья после каждого раунда за ранг', maxRank: 3 }
    ]
  }
];

const TALENTS_BY_ID = new Map(TALENT_TREES.flatMap((tree) => tree.talents.map((talent) => [talent.id, talent])));

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function normalizeResistances(resistances = {}) {
  return Object.fromEntries(DAMAGE_TYPES.map((type) => [
    type,
    clamp(resistances?.[type], -100, RESISTANCE_CAP)
  ]));
}

function resolveCombatHit({
  baseDamage,
  damageType = 'physical',
  defense = 0,
  armor = 0,
  resistances = {},
  critChance = 0,
  critMultiplier = 2,
  dodgeChance = 0,
  blockChance = 0,
  blockMitigation = 0.5,
  rng = Math.random
}) {
  const type = DAMAGE_TYPES.includes(damageType) ? damageType : 'physical';
  const rawDamage = Math.max(0, Number(baseDamage) || 0);
  if (rng() < clamp(dodgeChance, 0, 0.75)) {
    return { damage: 0, damageType: type, critical: false, dodged: true, blocked: false };
  }

  const critical = rng() < clamp(critChance, 0, 0.75);
  let damage = rawDamage * (critical ? Math.max(1, Number(critMultiplier) || 1) : 1);

  if (type === 'physical') {
    damage = Math.max(0, damage - Math.max(0, Number(defense) || 0));
    const safeArmor = Math.max(0, Number(armor) || 0);
    damage = Math.max(0, damage * (1 - ((safeArmor / 200) ** 2)) - Math.floor(safeArmor / 3));
  }

  const resistance = normalizeResistances(resistances)[type];
  damage *= 1 - resistance / 100;

  const blocked = rng() < clamp(blockChance, 0, 0.75);
  if (blocked) damage *= 1 - clamp(blockMitigation, 0, 1);

  return {
    damage: damage > 0 ? Math.max(1, Math.round(damage)) : 0,
    damageType: type,
    critical,
    dodged: false,
    blocked,
    resistance
  };
}

function getTalentBonuses(talents = {}) {
  const rank = (id) => clamp(talents?.[id], 0, TALENTS_BY_ID.get(id)?.maxRank || 3);
  const ward = rank('ward');
  return {
    attack: rank('power'),
    critChance: rank('precision') * 0.03,
    dodgeChance: rank('evasion') * 0.03,
    blockChance: rank('guard') * 0.05,
    healthRegen: rank('mending'),
    resistances: { physical: 0, magic: ward * 5, poison: ward * 5 }
  };
}

function upgradeTalent(talents = {}, points = 0, talentId) {
  const talent = TALENTS_BY_ID.get(talentId);
  if (!talent) throw new Error('Неизвестный талант.');
  const talentPoints = Math.max(0, Math.floor(Number(points) || 0));
  if (talentPoints < 1) throw new Error('Недостаточно очков талантов.');

  const currentRank = clamp(talents[talentId], 0, talent.maxRank);
  if (currentRank >= talent.maxRank) throw new Error('Талант уже улучшен до максимального ранга.');

  return {
    talents: { ...talents, [talentId]: currentRank + 1 },
    talentPoints: talentPoints - 1
  };
}

function normalizeGold(value) {
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(Number(value) || 0)));
}

function getSalePrice(item, basePrice) {
  const rarityMultipliers = { common: 0.5, rare: 0.75, epic: 1, legendary: 1.5 };
  const price = normalizeGold(basePrice);
  return Math.max(1, Math.floor(price * (rarityMultipliers[item?.rarity] || rarityMultipliers.common)));
}

module.exports = {
  DAMAGE_TYPES,
  TALENT_TREES,
  getSalePrice,
  getTalentBonuses,
  normalizeGold,
  normalizeResistances,
  resolveCombatHit,
  upgradeTalent
};
