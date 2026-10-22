const STORAGE_KEY = 'rpg_current_character';
const STORAGE_ID_KEY = 'rpg_current_id';

function loadHeroForStats() {
  try {
    const savedId = localStorage.getItem(STORAGE_ID_KEY);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (savedId && saved && saved.id) return { id: savedId, ...saved };
  } catch {
    localStorage.removeItem(STORAGE_ID_KEY);
    localStorage.removeItem(STORAGE_KEY);
  }
  return null;
}

function renderHeroStats() {
  const hero = loadHeroForStats();
  if (!hero) {
    window.location.href = '/';
    return;
  }

  const num = (value) => Math.round(Number(value) || 0);
  const rows = [
    ['Уровень', num(hero.level) || 1],
    ['Опыт', `${num(hero.xp)} / ${num(hero.xpToNext) || 1}`],
    ['Сила', num(hero.str)],
    ['Ловкость', num(hero.agi)],
    ['Интеллект', num(hero.int)],
    ['Здоровье', `${num(hero.hp)} / ${num(hero.maxHp) || num(hero.hp)}`],
    ['Энергия', `${num(hero.mana)} / ${num(hero.maxMana) || 100}`],
    ['Броня', num(hero.armor)],
    ['Критический удар', `${Math.round((Number(hero.critChance) || 0) * 100)}%`],
    ['Уклонение', `${Math.round((Number(hero.dodgeChance) || 0) * 100)}%`],
    ['Блок', `${Math.round((Number(hero.blockChance) || 0) * 100)}%`],
    ['Сопротивление физическому урону', `${num(hero.resistances?.physical)}%`],
    ['Сопротивление магии', `${num(hero.resistances?.magic)}%`],
    ['Сопротивление яду', `${num(hero.resistances?.poison)}%`],
    ['Золото', num(hero.gold)],
    ['Победы', num(hero.kills)]
  ];

  const list = document.createElement('dl');
  list.className = 'profile-rows profile-stats';
  rows.forEach(([label, value]) => {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    row.append(dt, dd);
    list.append(row);
  });
  document.getElementById('heroStats').replaceChildren(list);
}

renderHeroStats();
