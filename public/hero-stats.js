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
  const pct = (v) => `${Math.round((Number(v) || 0) * 100)}%`;
  const groups = [
    ['Основные', [
      ['Уровень', num(hero.level) || 1],
      ['Опыт', `${num(hero.xp)} / ${num(hero.xpToNext) || 1}`],
      ['Победы', num(hero.kills)]
    ]],
    ['Характеристики', [
      ['Сила', num(hero.str)],
      ['Ловкость', num(hero.agi)],
      ['Интеллект', num(hero.int)],
      ['Здоровье', `${num(hero.hp)} / ${num(hero.maxHp) || num(hero.hp)}`],
      ['Энергия', `${num(hero.mana)} / ${num(hero.maxMana) || 100}`]
    ]],
    ['Защита', [
      ['Броня', num(hero.armor)],
      ['Уклонение', pct(hero.dodgeChance)],
      ['Блок', pct(hero.blockChance)],
      ['Сопротивление физическому урону', `${num(hero.resistances?.physical)}%`],
      ['Сопротивление магии', `${num(hero.resistances?.magic)}%`],
      ['Сопротивление яду', `${num(hero.resistances?.poison)}%`]
    ]],
    ['Атака', [
      ['Критический удар', pct(hero.critChance)]
    ]]
  ];

  const title = document.getElementById('statsTitle');
  if (title && hero.name) title.textContent = `Статистика ${hero.name}`;

  const resources = document.getElementById('statsResources');
  if (resources) {
    resources.replaceChildren(...[
      ['🪙', 'Золото', num(hero.gold)],
      ['❤️', 'Здоровье', num(hero.hp)],
      ['🔷', 'Энергия', num(hero.mana)]
    ].map(([icon, label, value]) => {
      const item = document.createElement('span');
      item.className = 'stats-resource';
      item.title = label;
      item.textContent = `${icon} ${value}`;
      return item;
    }));
  }

  const fragment = document.createDocumentFragment();
  groups.forEach(([heading, rows]) => {
    const section = document.createElement('section');
    section.className = 'stats-group';
    const h2 = document.createElement('h2');
    h2.textContent = heading;
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
    section.append(h2, list);
    fragment.append(section);
  });
  document.getElementById('heroStats').replaceChildren(fragment);
}

renderHeroStats();
