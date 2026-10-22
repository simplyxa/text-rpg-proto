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

function createGearRow(name, rarity, details = '') {
  const row = document.createElement('article');
  row.className = 'gear-row';
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
  const container = document.getElementById('equipmentList');
  container.replaceChildren();
  PAGE_SLOTS.forEach(({ id, name }) => {
    const row = createGearRow(name);
    row.classList.add('equipment-page-slot');
    const item = character.equipment?.[id];
    if (item) {
      const itemDetails = document.createElement('div');
      itemDetails.className = 'equipped-details';
      const itemName = document.createElement('strong');
      itemName.className = `rarity-${item.rarity || 'common'}`;
      itemName.textContent = item.name;
      const rarity = document.createElement('span');
      rarity.textContent = rarityName(item.rarity);
      const armor = document.createElement('span');
      armor.className = 'armor-bonus';
      armor.textContent = `Защита: +${itemArmor(item)}`;
      itemDetails.append(itemName, rarity, armor);
      row.append(itemDetails);

      const button = document.createElement('button');
      button.className = 'small-btn';
      button.type = 'button';
      button.textContent = 'Снять';
      button.addEventListener('click', () => unequipItem(id));
      row.append(button);
    } else {
      const empty = document.createElement('span');
      empty.className = 'equipment-empty';
      empty.textContent = 'Пусто';
      row.append(empty);
    }
    container.append(row);
  });
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

async function renderInventoryPage() {
  const container = document.getElementById('inventoryList');
  const result = await requestJson(`/api/inventory?id=${encodeURIComponent(characterId)}`);
  const inventory = result.inventory || [];
  const equipped = Object.values(character.equipment || {}).filter(Boolean);
  const items = [
    ...equipped.map((item) => ({ ...item, equipped: true })),
    ...inventory
  ];
  container.replaceChildren();

  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'inventory-empty';
    empty.textContent = 'Инвентарь пуст';
    container.append(empty);
    return;
  }

  items.forEach((item) => {
    const details = [item.slot ? `Защита: +${itemArmor(item)}` : '', item.qty > 1 ? `Количество: ${item.qty}` : ''].filter(Boolean).join(' • ');
    const row = createGearRow(item.name, item.rarity, details);
    if (item.equipped) {
      const equippedLabel = document.createElement('span');
      equippedLabel.className = 'equipped-label';
      equippedLabel.textContent = '(надет)';
      row.append(equippedLabel);
    } else if (item.slot) {
      const button = document.createElement('button');
      button.className = 'small-btn';
      button.type = 'button';
      button.textContent = 'Надеть';
      button.addEventListener('click', () => equipItem(item.id));
      row.append(button);
    }
    container.append(row);
  });
}

async function loadInventoryPage() {
  if (!await loadCharacter()) return;
  try {
    await renderInventoryPage();
  } catch (error) {
    showMessage(error.message);
  }
}

async function equipItem(itemId) {
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
    await renderInventoryPage();
    showMessage(result.message);
  } catch (error) {
    showMessage(error.message);
  }
}

async function loadShopPage() {
  if (!await loadCharacter()) return;
  document.getElementById('gold').textContent = character.gold;
  const container = document.getElementById('shopItems');
  container.replaceChildren();
  SHOP_ITEMS.forEach((item) => {
    const row = createGearRow(item.name, 'common', `Защита: +${item.armor} • 1500 золота`);
    const button = document.createElement('button');
    button.className = 'small-btn';
    button.type = 'button';
    button.textContent = 'Купить';
    button.addEventListener('click', () => buyItem(item.name, 1500));
    row.append(button);
    container.append(row);
  });
  document.getElementById('buySetButton').addEventListener('click', buyEquipmentSet);
}

async function buyItem(itemName, price) {
  const item = SHOP_ITEMS.find((candidate) => candidate.name === itemName);
  if (!item) {
    showMessage('Неизвестный предмет.');
    return;
  }

  try {
    const result = await requestJson('/api/buyEquipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: characterId, itemId: item.id, price })
    });
    saveCharacter(result.character);
    document.getElementById('gold').textContent = character.gold;
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
    document.getElementById('gold').textContent = character.gold;
    showMessage(result.message);
  } catch (error) {
    showMessage(error.message);
  }
}

const pageLoaders = {
  equipment: loadEquipmentPage,
  inventory: loadInventoryPage,
  shop: loadShopPage
};
pageLoaders[document.body.dataset.page]?.();
