const STORAGE_KEY = 'rpg_current_character';
const STORAGE_ID_KEY = 'rpg_current_id';
const PAGE_SLOTS = [
  { id: 'helmet', name: 'Голова' },
  { id: 'ring', name: 'Шея' },
  { id: 'chest', name: 'Туловище' },
  { id: 'hands', name: 'Руки' },
  { id: 'armor', name: 'Ноги' },
  { id: 'boots', name: 'Ступни' },
  { id: 'shield', name: 'Левая рука' },
  { id: 'cloak', name: 'Правая рука' }
];
const SHOP_ITEMS = [
  { id: 'helmet', name: 'Шлем', armor: 2 },
  { id: 'amulet', name: 'Амулет', armor: 1 },
  { id: 'armor', name: 'Броня', armor: 5 },
  { id: 'gloves', name: 'Перчатки', armor: 1 },
  { id: 'pants', name: 'Штаны', armor: 2 },
  { id: 'boots', name: 'Сапоги', armor: 1 },
  { id: 'left_blade', name: 'Левый клинок', armor: 0 },
  { id: 'right_blade', name: 'Правый клинок', armor: 3 }
];

let characterId;
let character;
let shopCatalog = [];

function saveCharacter(nextCharacter) {
  character = nextCharacter;
  characterId = nextCharacter.id || characterId;
  localStorage.setItem(STORAGE_ID_KEY, characterId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCharacter));
}

function showMessage(message) {
  document.getElementById('pageMessage').textContent = message || '';
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Не удалось выполнить действие.');
  return result;
}

async function loadCharacter() {
  characterId = localStorage.getItem(STORAGE_ID_KEY);
  if (!characterId) {
    window.location.href = '/';
    return false;
  }

  try {
    const result = await requestJson(`/api/character?id=${encodeURIComponent(characterId)}`);
    saveCharacter(result.character);
    return true;
  } catch {
    localStorage.removeItem(STORAGE_ID_KEY);
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = '/';
    return false;
  }
}

function rarityName(rarity) {
  return ({
    common: 'Обычный',
    rare: 'Редкий',
    epic: 'Эпический',
    legendary: 'Легендарный'
  })[rarity] || rarity || 'Обычный';
}

function itemArmor(item) {
  if (Object.hasOwn(item?.statBonus || {}, 'armor')) return Number(item.statBonus.armor) || 0;
  const shopItem = SHOP_ITEMS.find((candidate) => candidate.name === item?.name || item?.id === candidate.id || item?.id?.startsWith(`${candidate.id}_`));
  const slotArmor = { helmet: 2, ring: 1, chest: 5, hands: 1, armor: 2, boots: 1, shield: 3, cloak: 0 };
  return shopItem?.armor ?? slotArmor[item?.slot] ?? 0;
}

function enhancedStat(value, enhancement) {
  const level = Math.min(10, Math.max(0, Math.floor(Number(enhancement) || 0)));
  return (Number(value) || 0) * (1 + level * 0.1);
}

function itemStatDetails(item) {
  const labels = {
    str: 'Сила',
    agi: 'Ловкость',
    int: 'Интеллект',
    maxHp: 'Здоровье',
    armor: 'Защита',
    attack: 'Атака',
    defense: 'Снижение урона',
    healthRegen: 'Регенерация'
  };
  const details = Object.entries(labels)
    .filter(([stat]) => Number(item.statBonus?.[stat]) > 0)
    .map(([stat, label]) => `${label} +${item.statBonus[stat]}`);
  Object.entries(item.statBonus?.resistances || {}).forEach(([type, value]) => {
    if (Number(value) > 0) details.push(`Сопротивление ${type} +${value}%`);
  });
  return details.join(' • ') || 'Без бонусов';
}

function createGearRow(name, rarity, details = '', item = null) {
  const row = document.createElement('article');
  row.className = 'gear-row';
  if (item?.id) row.dataset.iconId = item.id;
  if (item?.slot) row.dataset.iconSlot = item.slot;
  if (item?.rarity) row.dataset.iconRarity = item.rarity;
  const description = document.createElement('div');
  description.className = 'gear-description';
  const itemName = document.createElement('strong');
  itemName.className = `rarity-${rarity || 'common'}`;
  itemName.textContent = name;
  description.append(itemName);

  if (rarity) {
    const rarityLabel = document.createElement('span');
    rarityLabel.className = 'gear-rarity';
    rarityLabel.textContent = rarityName(rarity);
    description.append(rarityLabel);
  }
  if (details) {
    const detailLabel = document.createElement('span');
    detailLabel.className = 'gear-detail';
    detailLabel.textContent = details;
    description.append(detailLabel);
  }
  row.append(description);
  return row;
}

function renderEquipmentPage() {
  document.getElementById('equipmentTotal').textContent = `Общая защита: ${Number(character.armor) || Object.values(character.equipment || {}).reduce((total, item) => total + itemArmor(item), 0)}`;
  const portrait = document.getElementById('equipmentPortrait');
  portrait.textContent = (character.name || '?').trim().charAt(0).toUpperCase() || '?';
  portrait.setAttribute('aria-label', `Персонаж ${character.name || ''}`.trim());
  const container = document.getElementById('equipmentList');
  container.replaceChildren();
  PAGE_SLOTS.forEach(({ id, name }) => {
    const item = character.equipment?.[id];
    const row = createGearRow(name, undefined, '', item);
    row.classList.add('equipment-page-slot');
    row.querySelector('.gear-description')?.remove();
    const itemDetails = document.createElement('div');
    itemDetails.className = 'equipped-details';
    const itemName = document.createElement('strong');
    if (item) {
      itemName.className = `rarity-${item.rarity || 'common'}`;
      itemName.textContent = item.name;
      const enhancement = Math.min(10, Math.max(0, Math.floor(Number(item.enhancement) || 0)));
      const stats = document.createElement('span');
      stats.className = 'armor-bonus';
      stats.textContent = `Ур. ${enhancement} • Защита: +${enhancedStat(itemArmor(item), enhancement).toFixed(1).replace(/\.0$/, '')}`;
      itemDetails.append(itemName, stats);
      row.append(itemDetails);

      const button = document.createElement('button');
      button.className = 'small-btn';
      button.type = 'button';
      button.textContent = 'Снять';
      button.addEventListener('click', () => unequipItem(id));
      row.append(button);
    } else {
      itemName.textContent = name;
      const empty = document.createElement('span');
      empty.className = 'equipment-empty';
      empty.textContent = 'Пусто';
      itemDetails.append(itemName, empty);
      row.append(itemDetails);
    }
    container.append(row);
  });
  renderEquipmentWithIcons(container);
}

async function loadEquipmentPage() {
  if (await loadCharacter()) renderEquipmentPage();
}

async function unequipItem(slot) {
  try {
    const result = await requestJson('/api/unequipItem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: characterId, slot })
    });
    saveCharacter(result.character);
    renderEquipmentPage();
    showMessage(result.message);
  } catch (error) {
    showMessage(error.message);
  }
}

function getUnequippedItems(items = character.inventory || []) {
  const equippedIds = new Set(Object.values(character.equipment || {}).filter(Boolean).map((item) => item.id));
  return items.filter((item) => item.slot && PAGE_SLOTS.some((slot) => slot.id === item.slot) && !equippedIds.has(item.id));
}

async function renderInventory() {
  const container = document.getElementById('inventoryList');
  const result = await requestJson(`/api/inventory?id=${encodeURIComponent(characterId)}`);
  const items = getUnequippedItems(result.inventory || []);
  container.replaceChildren();

  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'inventory-empty';
    empty.textContent = 'Нет ненадетого снаряжения';
    container.append(empty);
    return;
  }

  items.forEach((item) => {
    const details = itemStatDetails(item);
    const row = createGearRow(item.name, item.rarity, details, item);
    row.classList.add('inventory-item-row');
    const button = document.createElement('button');
    button.className = 'small-btn inventory-equip-button';
    button.type = 'button';
    button.textContent = 'Надеть';
    button.addEventListener('click', () => equipItemFromInventory(item.id));
    row.append(button);
    container.append(row);
  });
  renderInventoryWithIcons(container);
}

async function loadInventoryPage() {
  if (!await loadCharacter()) return;
  try {
    await renderInventory();
  } catch (error) {
    showMessage(error.message);
  }
}

async function equipItemFromInventory(itemId) {
  const item = character.inventory?.find((candidate) => candidate.id === itemId);
  if (!item?.slot) {
    showMessage('Этот предмет нельзя надеть.');
    return;
  }

  try {
    const result = await requestJson('/api/equipItem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: characterId, itemId, slot: item.slot })
    });
    saveCharacter(result.character);
    await renderInventory();
    showMessage(result.message);
  } catch (error) {
    showMessage(error.message);
  }
}

async function loadShopPage() {
  if (!await loadCharacter()) return;
  document.getElementById('buySetButton').addEventListener('click', buyEquipmentSet);
  await renderShopPage();
}

async function renderShopPage() {
  const result = await requestJson(`/api/shop?id=${encodeURIComponent(characterId)}`);
  shopCatalog = result.items;
  document.getElementById('gold').textContent = character.gold;
  const container = document.getElementById('shopItems');
  container.replaceChildren();
  shopCatalog.forEach((item) => {
    const row = createGearRow(item.name, item.rarity, `${itemStatDetails(item)} • ${item.price} золота`, item);
    const button = document.createElement('button');
    button.className = 'small-btn';
    button.type = 'button';
    button.textContent = 'Купить';
    button.addEventListener('click', () => buyItem(item.id));
    row.append(button);
    container.append(row);
  });
  renderShopWithIcons(container);
  const playerItems = document.getElementById('playerItems');
  playerItems.replaceChildren();
  if (!result.inventory.length) {
    const empty = document.createElement('p');
    empty.className = 'inventory-empty';
    empty.textContent = 'Нет предметов для продажи.';
    playerItems.append(empty);
    return;
  }
  result.inventory.forEach((item) => {
    const row = createGearRow(item.name, item.rarity, `${itemStatDetails(item)} • Продажа: ${item.sellPrice} золота`, item);
    const button = document.createElement('button');
    button.className = 'small-btn';
    button.type = 'button';
    button.textContent = 'Продать';
    button.addEventListener('click', () => sellItem(item.id));
    row.append(button);
    playerItems.append(row);
  });
  renderShopWithIcons(playerItems);
}

async function buyItem(itemId) {
  const item = shopCatalog.find((candidate) => candidate.id === itemId);
  if (!item) {
    showMessage('Неизвестный предмет.');
    return;
  }

  try {
    const result = await requestJson('/api/buyEquipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: characterId, itemId: item.id })
    });
    saveCharacter(result.character);
    await renderShopPage();
    showMessage(result.message);
  } catch (error) {
    showMessage(error.message);
  }
}

async function sellItem(itemId) {
  try {
    const result = await requestJson('/api/sellItem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: characterId, itemId })
    });
    saveCharacter(result.character);
    await renderShopPage();
    showMessage(result.message);
  } catch (error) {
    showMessage(error.message);
  }
}

async function buyEquipmentSet() {
  try {
    const result = await requestJson('/api/buyEquipmentSet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: characterId })
    });
    saveCharacter(result.character);
    await renderShopPage();
    showMessage(result.message);
  } catch (error) {
    showMessage(error.message);
  }
}

document.getElementById('repairAllButton')?.addEventListener('click', () => showMessage('Все вещи в отличном состоянии.'));

const pageLoaders = {
  equipment: loadEquipmentPage,
  inventory: loadInventoryPage,
  shop: loadShopPage
};
pageLoaders[document.body.dataset.page]?.();
