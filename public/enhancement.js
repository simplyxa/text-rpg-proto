const ENHANCEMENT_STORAGE_KEY = 'rpg_current_character';
const ENHANCEMENT_STORAGE_ID_KEY = 'rpg_current_id';
const ENHANCEMENT_COSTS = [100, 200, 300, 500, 800, 1200, 1800, 2500, 3500, 5000];
const ENHANCEMENT_CHANCES = [100, 95, 90, 85, 80, 70, 60, 50, 40, 30];
const LEGACY_SLOT_ARMOR = { helmet: 2, ring: 1, chest: 5, hands: 1, armor: 2, boots: 1, shield: 3, cloak: 0 };

function enhancementLevel(item) {
  return Math.min(10, Math.max(0, Math.floor(Number(item.enhancement) || 0)));
}

function enhancedStat(baseStat, level) {
  return (Number(baseStat) || 0) * (1 + level * 0.1);
}

function displayStat(value) {
  return Number(value.toFixed(1)).toString();
}

function appendStat(parent, label, value) {
  const row = document.createElement('p');
  row.className = 'enhancement-stat';
  row.textContent = `${label}: ${displayStat(value)}`;
  parent.append(row);
}

function renderEnhancementPage(character) {
  document.getElementById('goldDisplay').textContent = character.gold;
  const list = document.getElementById('enhancementList');
  list.replaceChildren();

  const equippedItems = Object.entries(character.equipment || {}).filter(([, item]) => item);
  if (!equippedItems.length) {
    const empty = document.createElement('p');
    empty.className = 'inventory-empty';
    empty.textContent = 'Нет надетого снаряжения для усиления.';
    list.append(empty);
    return;
  }

  equippedItems.forEach(([slot, item]) => {
    const level = enhancementLevel(item);
    const baseArmor = Number.isFinite(Number(item.statBonus?.armor))
      ? Number(item.statBonus.armor)
      : LEGACY_SLOT_ARMOR[slot] || 0;
    const baseDamage = Number(item.statBonus?.str) || 0;
    const card = document.createElement('article');
    card.className = 'enhancement-card';

    const header = document.createElement('div');
    header.className = 'enhancement-header';
    const icon = createItemIcon(item, 'equipment');
    if (icon) header.append(icon);
    const details = document.createElement('div');
    details.className = 'item-details';
    const title = document.createElement('h2');
    title.textContent = item.name;
    const levelLabel = document.createElement('span');
    levelLabel.className = `enhancement-level${level >= 5 ? ' enhancement-high' : ''}`;
    levelLabel.textContent = `+${level}`;
    title.append(levelLabel);
    details.append(title);
    appendStat(details, 'Базовая защита', baseArmor);
    appendStat(details, 'Защита с усилением', enhancedStat(baseArmor, level));
    if (baseDamage > 0) {
      appendStat(details, 'Базовый урон', baseDamage);
      appendStat(details, 'Урон с усилением', enhancedStat(baseDamage, level));
    }
    header.append(details);
    card.append(header);

    const info = document.createElement('div');
    info.className = 'enhancement-info';
    const nextCost = ENHANCEMENT_COSTS[level];
    const cost = document.createElement('p');
    cost.textContent = `Стоимость следующего уровня: ${nextCost ? `${nextCost} золота` : 'Максимум'}`;
    const chance = document.createElement('p');
    chance.textContent = `Вероятность успеха: ${ENHANCEMENT_CHANCES[level] ?? '-'}${level < 10 ? '%' : ''}`;
    const progress = document.createElement('div');
    progress.className = 'enhancement-progress';
    const fill = document.createElement('span');
    fill.style.width = `${level * 10}%`;
    const progressLabel = document.createElement('strong');
    progressLabel.textContent = `${level}/10`;
    progress.append(fill, progressLabel);
    info.append(cost, chance, progress);
    card.append(info);

    if (level < 10 && character.gold >= nextCost) {
      const button = document.createElement('button');
      button.className = 'btn-enhance';
      button.type = 'button';
      button.textContent = 'Усилить';
      button.addEventListener('click', () => enhanceItem(slot, button));
      card.append(button);
    } else {
      const status = document.createElement('p');
      status.className = 'enhancement-unavailable';
      status.textContent = level >= 10 ? 'Максимальный уровень' : 'Недостаточно золота';
      card.append(status);
    }
    list.append(card);
  });
}

async function enhanceItem(slot, button) {
  const id = localStorage.getItem(ENHANCEMENT_STORAGE_ID_KEY);
  const message = document.getElementById('enhancementMessage');
  button.disabled = true;
  try {
    const response = await fetch('/api/enhanceItem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, slot })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не удалось усилить предмет.');
    localStorage.setItem(ENHANCEMENT_STORAGE_KEY, JSON.stringify(result.character));
    message.textContent = result.message;
    renderEnhancementPage(result.character);
  } catch (error) {
    message.textContent = error.message;
    button.disabled = false;
  }
}

async function loadEnhancementPage() {
  const id = localStorage.getItem(ENHANCEMENT_STORAGE_ID_KEY);
  if (!id) {
    window.location.href = '/';
    return;
  }
  try {
    const response = await fetch(`/api/character?id=${encodeURIComponent(id)}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не удалось загрузить персонажа.');
    localStorage.setItem(ENHANCEMENT_STORAGE_KEY, JSON.stringify(result.character));
    renderEnhancementPage(result.character);
  } catch (error) {
    document.getElementById('enhancementMessage').textContent = error.message;
  }
}

document.addEventListener('DOMContentLoaded', loadEnhancementPage);
