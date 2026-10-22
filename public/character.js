const STORAGE_KEY = 'rpg_current_character';
const STORAGE_ID_KEY = 'rpg_current_id';
const POTIONS = {
  potion_health: { name: 'Зелье', effect: 'Восстанавливает 100% HP и энергии', icon: 'potion-health.svg' }
};
const LEGACY_POTION_IDS = ['potion', 'potion_mana', 'potion_strength', 'potion_armor'];

function cleanInventory(inventory = []) {
  const cleaned = [];
  inventory
    .filter((item) => item?.id !== 'food' && item?.name !== 'Пирожок')
    .forEach((item) => {
      if (item?.id !== 'potion_health' && !LEGACY_POTION_IDS.includes(item?.id)) return cleaned.push(item);
      const existing = cleaned.find((entry) => entry.id === 'potion_health');
      if (existing) existing.qty = (Number(existing.qty) || 0) + (Number(item.qty) || 0);
      else cleaned.push({ id: 'potion_health', name: POTIONS.potion_health.name, effect: POTIONS.potion_health.effect, qty: Number(item.qty) || 0 });
    });
  return cleaned;
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
    window.renderHpBar?.();
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
  const potionCount = cleanInventory(character.inventory)
    .filter((item) => item.id === 'potion_health')
    .reduce((total, item) => total + (Number(item.qty) || 0), 0);
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
        <div class="profile-total"><dt>Сумма</dt><dd>${Math.round(strength + health + energy + armor)}</dd></div>
      </dl>
    </section>

    <section class="profile-section" aria-labelledby="bonusesHeading">
      <h2 id="bonusesHeading">Бонусы и модификаторы</h2>
      <div class="profile-rows profile-bonuses">
        <div><span>Алтарь</span><strong>+5% к опыту</strong><small>ещё 2 дн.</small></div>
        <div><span>Мастер</span><strong>+2 к силе</strong><small>постоянно</small></div>
        <div><span>Таланты</span><strong>${Object.values(character.talents || {}).reduce((total, rank) => total + (Number(rank) || 0), 0)} рангов</strong><small>${Number(character.talentPoints) || 0} очков</small></div>
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
      <a class="profile-statistics-link" href="/hero-stats">Статистика героя <span>›</span></a>
    </section>

    <section class="profile-section" id="profileResources" aria-labelledby="resourcesHeading">
      <h2 id="resourcesHeading">Ресурсы</h2>
      <dl class="profile-rows profile-details">
        <div><dt>Ресурсы</dt><dd>12 дерева · 4 руды</dd></div>
        <div><dt>Зелья</dt><dd>${potionCount} <button class="small-btn potion-use-button" type="button" data-use-potion ${potionCount > 0 ? '' : 'disabled'}>Использовать</button></dd></div>
      </dl>
    </section>

  `;

  const potionButton = characterCard.querySelector('[data-use-potion]');
  if (potionButton) potionButton.onclick = usePotion;

  document.querySelectorAll('[data-profile-placeholder]').forEach((link) => {
    link.onclick = (event) => {
      event.preventDefault();
      document.getElementById('profileMessage').textContent =
        `Раздел «${link.dataset.profilePlaceholder}» скоро появится в игре.`;
    };
  });
}

async function usePotion() {
  const characterId = localStorage.getItem(STORAGE_ID_KEY);
  const message = document.getElementById('profileMessage');
  try {
    const response = await fetch('/api/usePotion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: characterId })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не удалось использовать зелье.');
    const character = { ...result.character, inventory: cleanInventory(result.character.inventory) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
    window.renderHpBar?.();
    message.textContent = result.message || '';
    renderCharacterPage(character);
  } catch (error) {
    message.textContent = error.message;
  }
}

renderCharacterPage();
