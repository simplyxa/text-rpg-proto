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

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
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
  const profileIdentity = document.getElementById('profileIdentity');
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
  const strength = Number(character.str) || 0;
  const health = Number(character.hp) || 0;
  const energy = Number(character.mana) || 0;
  const xp = Number(character.xp) || 0;
  const xpToNext = Number(character.xpToNext) || 1;
  const xpPercentage = Math.min(100, Math.max(0, Math.round((xp / xpToNext) * 100)));
  const faction = character.faction === 'dark' ? 'Тёмные' : 'Светлые';
  const classNames = { warrior: 'Воин', rogue: 'Разбойник', mage: 'Маг' };
  const className = classNames[character.classId] || character.classId || 'Воин';
  const name = escapeHTML(character.name || 'Герой');
  const initials = escapeHTML((character.name || 'Г').trim().charAt(0).toUpperCase() || 'Г');

  title.textContent = 'Мой герой';
  profileIdentity.innerHTML = `
    <div class="profile-avatar" role="img" aria-label="Аватар ${name}">${initials}</div>
    <div class="profile-identity">
      <h2 class="profile-name">${name}</h2>
      <p>Уровень <strong>${Number(character.level) || 1}</strong> · ${escapeHTML(className)} · ${faction}</p>
      <p class="profile-subtitle">Клан: <span>Без клана</span> · Титул: <span>Новичок</span></p>
    </div>
  `;
  characterCard.innerHTML = `
    <section class="profile-section" aria-labelledby="statsHeading">
      <h2 id="statsHeading">Характеристики</h2>
      <dl class="profile-rows profile-stats">
        <div><dt>Сила</dt><dd>${strength}</dd></div>
        <div><dt>Здоровье</dt><dd>${health}/${Number(character.maxHp) || health}</dd></div>
        <div><dt>Энергия</dt><dd>${energy}/${Number(character.maxMana) || 100}</dd></div>
        <div><dt>Регенерация</dt><dd>+1</dd></div>
        <div><dt>Броня</dt><dd>${armor}</dd></div>
        <div class="profile-total"><dt>Сумма</dt><dd>${strength + health + energy + armor}</dd></div>
      </dl>
    </section>

    <section class="profile-section" aria-labelledby="bonusesHeading">
      <h2 id="bonusesHeading">Бонусы и модификаторы</h2>
      <div class="profile-rows profile-bonuses">
        <div><span>Алтарь</span><strong>+5% к опыту</strong><small>ещё 2 дн.</small></div>
        <div><span>Мастер</span><strong>+2 к силе</strong><small>постоянно</small></div>
        <div><span>Таланты</span><strong>+3 к здоровью</strong><small>постоянно</small></div>
        <div><span>Набор героя</span><strong>+1 к броне</strong><small>активен</small></div>
      </div>
    </section>

    <section class="profile-section" aria-label="Статусы героя">
      <div class="profile-status-list">
        <a href="#" data-profile-placeholder="Поход">Поход <span>не начат</span><b>›</b></a>
        <a href="#" data-profile-placeholder="Премиум">Премиум <span>не активен</span><b>›</b></a>
        <a href="#" data-profile-placeholder="Боевой навык">Боевой навык <span>0</span><b>›</b></a>
      </div>
      <dl class="profile-rows profile-details">
        <div><dt>Деньги</dt><dd>${Number(character.gold) || 0} золота</dd></div>
        <div><dt>Ресурсы</dt><dd>12 дерева · 4 руды</dd></div>
        <div><dt>Профессия</dt><dd>Не выбрана</dd></div>
        <div><dt>Участие</dt><dd>—</dd></div>
        <div class="profile-experience">
          <dt>Опыт</dt>
          <dd>
            <span>${xp} / ${xpToNext} (${xpPercentage}%)</span>
            <span class="profile-progress" role="progressbar" aria-label="Опыт героя" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${xpPercentage}"><span style="width: ${xpPercentage}%"></span></span>
          </dd>
        </div>
        <div><dt>Игры на арене</dt><dd>${Number(character.kills) || 0}</dd></div>
        <div><dt>Рейтинг арены</dt><dd>0</dd></div>
        <div><dt>Рейтинг турнира</dt><dd>—</dd></div>
      </dl>
      <a class="profile-statistics-link" href="#" data-profile-placeholder="Статистика героя">Статистика героя <span>›</span></a>
    </section>

    <section class="profile-section profile-extra" aria-label="Снаряжение и зелья">
      <div class="profile-current-stats">
        <span>Ловкость <strong>${Number(character.agi) || 0}</strong></span>
        <span>Интеллект <strong>${Number(character.int) || 0}</strong></span>
        <span>Локация <strong>${escapeHTML(character.location || 'town')}</strong></span>
      </div>
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

  document.querySelectorAll('[data-profile-placeholder]').forEach((link) => {
    link.onclick = (event) => {
      event.preventDefault();
      document.getElementById('profileMessage').textContent =
        `Раздел «${link.dataset.profilePlaceholder}» скоро появится в игре.`;
    };
  });
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
