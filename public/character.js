const STORAGE_KEY = 'rpg_current_character';
const STORAGE_ID_KEY = 'rpg_current_id';
const POTIONS = {
  potion_health: { name: 'Зелье Здоровья', effect: '+50 HP', icon: 'potion-health.svg' },
  potion_mana: { name: 'Зелье Маны', effect: '+30 Mana', icon: 'potion-mana.svg' },
  potion_strength: { name: 'Зелье Усиления', effect: '+5 Урона на 10 сек', icon: 'potion-strength.svg' },
  potion_armor: { name: 'Зелье Защиты', effect: '+10 Защиты на 10 сек', icon: 'potion-armor.svg' }
};

function cleanInventory(inventory = []) {
  return inventory
    .filter((item) => item?.id !== 'food' && item?.name !== 'Пирожок')
    .map((item) => item?.id === 'potion'
      ? { ...item, id: 'potion_health', name: POTIONS.potion_health.name, heal: 50 }
      : item);
}

function clearSessionState() {
  localStorage.removeItem(STORAGE_ID_KEY);
  localStorage.removeItem(STORAGE_KEY);
}

function restoreSessionState() {
  try {
    const savedId = localStorage.getItem(STORAGE_ID_KEY);
    const savedCharacter = localStorage.getItem(STORAGE_KEY);

    if (!savedId || !savedCharacter) return null;

    const parsed = JSON.parse(savedCharacter);
    if (!parsed || !parsed.id) return null;
    const character = { id: savedId, ...parsed, inventory: cleanInventory(parsed.inventory) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
    return character;
  } catch (error) {
    clearSessionState();
    return null;
  }
}

function renderCharacterPage(savedCharacter = restoreSessionState()) {
  const character = savedCharacter;
  const title = document.getElementById('title');
  const characterCard = document.getElementById('characterCard');

  if (!character) {
    clearSessionState();
    window.location.href = '/';
    return;
  }

  const armor = Number.isFinite(Number(character.armor))
    ? Number(character.armor)
    : Object.values(character.equipment || {}).reduce(
      (total, item) => total + (Number(item?.statBonus?.armor) || 0),
      0
    );
  title.textContent = character.name;
  characterCard.innerHTML = `
    <section class="character-stats">
    <p><strong>Класс:</strong> ${character.classId}</p>
    <p><strong>Уровень:</strong> ${character.level}</p>
    <p><strong>HP:</strong> ${character.hp}/${character.maxHp}</p>
    <p class="armor-stat"><strong>Защита:</strong> ${armor}</p>
    <p><strong>Мана:</strong> ${character.mana ?? 100}/${character.maxMana ?? 100}</p>
    <p><strong>Сила:</strong> ${character.str}</p>
    <p><strong>Ловкость:</strong> ${character.agi}</p>
    <p><strong>Интеллект:</strong> ${character.int}</p>
    <p><strong>Золото:</strong> ${character.gold}</p>
    <p><strong>Локация:</strong> ${character.location}</p>
    </section>
  `;

  characterCard.append(renderPotions(character));
  const equipmentSection = document.createElement('section');
  equipmentSection.className = 'character-equipment';
  const equipmentHeading = document.createElement('h2');
  equipmentHeading.textContent = 'Снаряжение';
  equipmentSection.append(equipmentHeading);
  const equippedItems = Object.values(character.equipment || {}).filter(Boolean);
  if (equippedItems.length) {
    const icons = document.createElement('div');
    icons.className = 'equipped-icons';
    equippedItems.forEach((item) => {
      const equippedItem = document.createElement('span');
      equippedItem.className = 'equipped-item-label';
      const icon = createItemIcon(item, 'equipment');
      if (icon) equippedItem.append(icon);
      const label = document.createElement('span');
      const enhancement = Math.min(10, Math.max(0, Math.floor(Number(item.enhancement) || 0)));
      label.textContent = `${item.name} +${enhancement}`;
      if (enhancement >= 5) label.classList.add('enhancement-high');
      equippedItem.append(label);
      icons.append(equippedItem);
    });
    equipmentSection.append(icons);
  }
  characterCard.append(equipmentSection);
}

function renderPotions(character) {
  const section = document.createElement('section');
  section.className = 'potions-section';
  const heading = document.createElement('h2');
  heading.textContent = 'Зелья';
  const list = document.createElement('div');
  list.className = 'potions-list';
  section.append(heading, list);

  const potions = cleanInventory(character.inventory).filter((item) => POTIONS[item.id] && Number(item.qty) > 0);
  if (!potions.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Нет зелий.';
    list.append(empty);
    return section;
  }

  potions.forEach((item) => {
    const potion = POTIONS[item.id];
    const card = document.createElement('article');
    card.className = 'potion-card';
    const icon = document.createElement('img');
    icon.src = `/images/potions/${potion.icon}`;
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    const details = document.createElement('div');
    details.className = 'potion-details';
    const name = document.createElement('strong');
    name.textContent = potion.name;
    const effect = document.createElement('span');
    effect.textContent = potion.effect;
    const quantity = document.createElement('span');
    quantity.textContent = `Количество: ${item.qty}`;
    details.append(name, effect, quantity);
    const button = document.createElement('button');
    button.className = 'small-btn potion-use-button';
    button.type = 'button';
    button.textContent = 'Использовать';
    button.addEventListener('click', () => usePotion(item.id));
    card.append(icon, details, button);
    list.append(card);
  });
  return section;
}

async function usePotion(potionId) {
  const characterId = localStorage.getItem(STORAGE_ID_KEY);
  const message = document.getElementById('profileMessage');
  try {
    const response = await fetch('/api/usePotion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: characterId, potionId })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не удалось использовать зелье.');
    const character = { ...result.character, inventory: cleanInventory(result.character.inventory) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
    message.textContent = result.message || '';
    renderCharacterPage(character);
  } catch (error) {
    message.textContent = error.message;
  }
}

renderCharacterPage();
