const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getSalePrice,
  getTalentBonuses,
  creditGold,
  normalizeGold,
  resolveCombatHit,
  spendGold,
  upgradeTalent
} = require('../game-systems');

test('combat applies damage type resistance and physical armor', () => {
  const hit = resolveCombatHit({
    baseDamage: 20,
    damageType: 'poison',
    resistances: { poison: 25 },
    rng: () => 0.99
  });
  assert.equal(hit.damage, 15);

  const magicHit = resolveCombatHit({
    baseDamage: 20,
    damageType: 'magic',
    resistances: { magic: 10 },
    armor: 100,
    rng: () => 0.99
  });
  assert.equal(magicHit.damage, 18);

  const physicalHit = resolveCombatHit({
    baseDamage: 20,
    defense: 2,
    armor: 6,
    rng: () => 0.99
  });
  assert.equal(physicalHit.damage, 16);
});

test('combat supports deterministic critical, dodge and block outcomes', () => {
  const critical = resolveCombatHit({
    baseDamage: 10,
    critChance: 1,
    rng: () => 0.5
  });
  assert.equal(critical.damage, 20);
  assert.equal(critical.critical, true);

  const dodged = resolveCombatHit({ baseDamage: 10, dodgeChance: 1, rng: () => 0 });
  assert.equal(dodged.damage, 0);
  assert.equal(dodged.dodged, true);

  const blocked = resolveCombatHit({ baseDamage: 10, blockChance: 1, rng: () => 0.5 });
  assert.equal(blocked.damage, 5);
  assert.equal(blocked.blocked, true);
});

test('talent upgrades consume one point and apply their combat bonuses', () => {
  const upgraded = upgradeTalent({ power: 1 }, 2, 'guard');
  assert.deepEqual(upgraded, { talents: { power: 1, guard: 1 }, talentPoints: 1 });
  assert.equal(getTalentBonuses(upgraded.talents).attack, 1);
  assert.equal(getTalentBonuses(upgraded.talents).blockChance, 0.05);
  assert.throws(() => upgradeTalent({}, 0, 'power'), /Недостаточно очков/);
});

test('shop prices and currency are normalized safely', () => {
  assert.equal(getSalePrice({ rarity: 'legendary' }, 1500), 2250);
  assert.equal(getSalePrice({}, 1500), 750);
  assert.equal(normalizeGold(-5), 0);
  assert.equal(normalizeGold(2.8), 2);
  assert.equal(normalizeGold(Infinity), 0);
  assert.equal(spendGold(1500, 1500), 0);
  assert.throws(() => spendGold(1499, 1500), /Недостаточно золота/);
  assert.equal(creditGold(-5, 750), 750);
});
