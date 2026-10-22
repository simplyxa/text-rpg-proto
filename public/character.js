const STORAGE_KEY = 'rpg_current_character';
const STORAGE_ID_KEY = 'rpg_current_id';

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

    return { id: savedId, ...parsed };
  } catch (error) {
    clearSessionState();
    return null;
  }
}

function renderCharacterPage() {
  const character = restoreSessionState();
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
    <p><strong>Класс:</strong> ${character.classId}</p>
    <p><strong>Уровень:</strong> ${character.level}</p>
    <p><strong>HP:</strong> ${character.hp}/${character.maxHp}</p>
    <p class="armor-stat"><strong>Защита:</strong> ${armor}</p>
    <p><strong>Сила:</strong> ${character.str}</p>
    <p><strong>Ловкость:</strong> ${character.agi}</p>
    <p><strong>Интеллект:</strong> ${character.int}</p>
    <p><strong>Золото:</strong> ${character.gold}</p>
    <p><strong>Локация:</strong> ${character.location}</p>
  `;

  const equippedItems = Object.values(character.equipment || {}).filter(Boolean);
  if (equippedItems.length) {
    const icons = document.createElement('div');
    icons.className = 'equipped-icons';
    equippedItems.forEach((item) => {
      const icon = createItemIcon(item, 'inventory');
      if (!icon) return;
      icon.title = item.name;
      icons.append(icon);
    });
    characterCard.append(icons);
  }
}

renderCharacterPage();
