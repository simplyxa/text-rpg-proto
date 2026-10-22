const api = (url, options = {}) => fetch(url, options).then((r) => r.json());

const STORAGE_KEY = 'rpg_current_character';
const STORAGE_ID_KEY = 'rpg_current_id';

let currentId = null;
let currentCharacter = null;

const authScreen = document.getElementById('authScreen');
const gameDiv = document.getElementById('game');
const modeButtons = document.querySelectorAll('.mode-btn');
const authPanels = document.querySelectorAll('.auth-panel');

const newNicknameInput = document.getElementById('newNickname');
const newClassInput = document.getElementById('newClass');
const newFactionInput = document.getElementById('newFaction');
const newPasswordInput = document.getElementById('newPassword');
const createBtn = document.getElementById('createBtn');
const startGameBtn = document.getElementById('startGameBtn');

const loginNicknameInput = document.getElementById('loginNickname');
const loginPasswordInput = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');

const statsDiv = document.getElementById('stats');
const logDiv = document.getElementById('log');
const gameStatus = document.getElementById('gameStatus');
const locationsDiv = document.getElementById('locations');
const characterListDiv = document.getElementById('characterList');

const profileContent = document.getElementById('profileContent');
const inventoryContent = document.getElementById('inventoryContent');
const questsContent = document.getElementById('questsContent');
const shopContent = document.getElementById('shopContent');

const fightBtn = document.getElementById('fightBtn');
const invBtn = document.getElementById('invBtn');
const questBtn = document.getElementById('questBtn');
const shopBtn = document.getElementById('shopBtn');

const tabButtons = document.querySelectorAll('.tab-button');
const tabPanels = document.querySelectorAll('.tab-panel');

const CLASS_NAMES = {
  warrior: 'Воин',
  healer: 'Лекарь',
  mage: 'Маг'
};

const FACTION_NAMES = {
  light: 'Светлые',
  dark: 'Тёмные'
};

const CLASS_BONUSES = {
  warrior: { str: 2, agi: 1, int: 0, maxHp: 12, hp: 12 },
  healer: { str: 0, agi: 1, int: 2, maxHp: 18, hp: 18 },
  mage: { str: 0, agi: 1, int: 3, maxHp: 10, hp: 10 }
};

const FACTION_BONUSES = {
  light: { str: 1, agi: 1, int: 2, maxHp: 8, hp: 8 },
  dark: { str: 2, agi: 2, int: 0, maxHp: 6, hp: 6 }
};

function getClassName(classId) {
  return CLASS_NAMES[classId] || classId || 'Воин';
}

function getFactionName(factionId) {
  return FACTION_NAMES[factionId] || factionId || 'Светлые';
}

function getFactionClass(factionId) {
  return (factionId || 'light').toLowerCase();
}

function getCharacterEffectText(character = {}) {
  const classId = character.classId || 'warrior';
  const factionId = character.faction || 'light';

  const classEffects = {
    warrior: 'Мощный удар',
    healer: 'Лечение',
    mage: 'Магический всплеск'
  };

  const factionEffects = {
    light: 'Свет',
    dark: 'Тень'
  };

  return `${classEffects[classId] || 'Мощный удар'} • ${factionEffects[factionId] || 'Свет'}`;
}

function applyCharacterBonuses(character) {
  if (!character) return character;

  const classId = character.classId || 'warrior';
  const factionId = character.faction || 'light';

  const base = character.baseStats || {
    str: Number(character.str) || 0,
    agi: Number(character.agi) || 0,
    int: Number(character.int) || 0,
    maxHp: Number(character.maxHp) || 0,
    hp: Number(character.hp) || 0
  };

  character.baseStats = { ...base };

  const classBonus = CLASS_BONUSES[classId] || { str: 0, agi: 0, int: 0, maxHp: 0, hp: 0 };
  const factionBonus = FACTION_BONUSES[factionId] || { str: 0, agi: 0, int: 0, maxHp: 0, hp: 0 };

  const nextStr = base.str + classBonus.str + factionBonus.str;
  const nextAgi = base.agi + classBonus.agi + factionBonus.agi;
  const nextInt = base.int + classBonus.int + factionBonus.int;
  const nextMaxHp = base.maxHp + classBonus.maxHp + factionBonus.maxHp;
  const nextHp = Math.min(
    Math.max(base.hp + classBonus.hp + factionBonus.hp, 1),
    Math.max(nextMaxHp, 1)
  );

  character.str = nextStr;
  character.agi = nextAgi;
  character.int = nextInt;
  character.maxHp = nextMaxHp;
  character.hp = nextHp;
  character.effectText = getCharacterEffectText(character);

  return character;
}

function saveSessionState() {
  if (currentId && currentCharacter) {
    localStorage.setItem(STORAGE_ID_KEY, String(currentId));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentCharacter));
  } else {
    localStorage.removeItem(STORAGE_ID_KEY);
    localStorage.removeItem(STORAGE_KEY);
  }
}

function clearSessionState() {
  currentId = null;
  currentCharacter = null;
  localStorage.removeItem(STORAGE_ID_KEY);
  localStorage.removeItem(STORAGE_KEY);
}

function logoutGame() {
  clearSessionState();
  window.location.href = '/';
}

function restoreSessionState() {
  try {
    const savedId = localStorage.getItem(STORAGE_ID_KEY);
    const savedCharacter = localStorage.getItem(STORAGE_KEY);

    if (!savedId || !savedCharacter) {
      clearSessionState();
      return false;
    }

    const parsed = JSON.parse(savedCharacter);
    if (!parsed || !parsed.id) {
      clearSessionState();
      return false;
    }

    currentId = savedId;
    currentCharacter = applyCharacterBonuses({ ...parsed, faction: parsed.faction || 'light' });
    return true;
  } catch {
    clearSessionState();
    return false;
  }
}

function setLog(text) {
  logDiv.textContent = text;
}

function appendLog(text) {
  logDiv.textContent = (logDiv.textContent ? logDiv.textContent + '\n\n' : '') + text;
}

function setActiveTab(name) {
  tabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === `${name}-panel`);
  });
}

function setAuthMode(mode) {
  modeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.authMode === mode);
  });

  authPanels.forEach((panel) => {
    const shouldShow = panel.id === `${mode}Panel`;
    panel.classList.toggle('active', shouldShow);
  });
}

function showGameScreen() {
  authScreen.classList.add('hidden');
  gameDiv.classList.remove('hidden');
}

function showAuthScreen() {
  authScreen.classList.remove('hidden');
  gameDiv.classList.add('hidden');
}

function goToCityPage() {
  window.location.href = '/city.html';
}

function renderCharacter(c) {
  if (!c) return;

  const safeC = applyCharacterBonuses({
    ...c,
    faction: c.faction || 'light',
    classId: c.classId || 'warrior'
  });

  currentCharacter = safeC;
  currentId = safeC.id;
  saveSessionState();

  const className = getClassName(safeC.classId);
  const factionName = getFactionName(safeC.faction || 'light');
  const factionClass = getFactionClass(safeC.faction || 'light');

  statsDiv.innerHTML = `
    <strong>${safeC.name}</strong> (${className})<br>
    Фракция: <span class="faction-tag ${factionClass}">${factionName}</span><br>
    Эффект: <span class="effect-pill">${safeC.effectText}</span><br>
    Уровень: ${safeC.level}<br>
    HP: ${safeC.hp}/${safeC.maxHp}<br>
    Сила: ${safeC.str} | Ловкость: ${safeC.agi} | Интеллект: ${safeC.int}<br>
    Опыт: ${safeC.xp}/${safeC.xpToNext}<br>
    Золото: ${safeC.gold}<br>
    Локация: ${safeC.location}
  `;

  profileContent.classList.remove('light', 'dark');
  profileContent.classList.add(factionClass);
  profileContent.innerHTML = `
    <h3>Профиль героя</h3>
    <p><strong>Ник:</strong> ${safeC.name}</p>
    <p><strong>Класс:</strong> ${className}</p>
    <p><strong>Фракция:</strong> <span class="faction-tag ${factionClass}">${factionName}</span></p>
    <p><strong>Эффект:</strong> <span class="effect-pill">${safeC.effectText}</span></p>
    <p><strong>Уровень:</strong> ${safeC.level}</p>
    <p><strong>HP:</strong> ${safeC.hp}/${safeC.maxHp}</p>
    <p><strong>Сила:</strong> ${safeC.str}</p>
    <p><strong>Ловкость:</strong> ${safeC.agi}</p>
    <p><strong>Интеллект:</strong> ${safeC.int}</p>
    <p><strong>Опыт:</strong> ${safeC.xp}/${safeC.xpToNext}</p>
    <p><strong>Золото:</strong> ${safeC.gold}</p>
    <p><strong>Локация:</strong> ${safeC.location}</p>

    <label>
      <span>Сменить класс</span>
      <select id="classSelect">
        <option value="warrior" ${safeC.classId === 'warrior' ? 'selected' : ''}>Воин</option>
        <option value="healer" ${safeC.classId === 'healer' ? 'selected' : ''}>Лекарь</option>
        <option value="mage" ${safeC.classId === 'mage' ? 'selected' : ''}>Маг</option>
      </select>
    </label>

    <label>
      <span>Сменить фракцию</span>
      <select id="factionSelect">
        <option value="light" ${(safeC.faction || 'light') === 'light' ? 'selected' : ''}>Светлые</option>
        <option value="dark" ${(safeC.faction || 'light') === 'dark' ? 'selected' : ''}>Тёмные</option>
      </select>
    </label>

    <button id="saveClassBtn" class="secondary-btn" type="button">Сохранить</button>
    <button id="logoutBtn" class="secondary-btn" type="button">Выйти</button>
  `;

  const classSelect = document.getElementById('classSelect');
  const factionSelect = document.getElementById('factionSelect');
  const saveClassBtn = document.getElementById('saveClassBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (saveClassBtn) {
    saveClassBtn.onclick = () => {
      const nextClass = classSelect.value;
      const nextFaction = factionSelect.value;

      currentCharacter.classId = nextClass;
      currentCharacter.faction = nextFaction;
      currentCharacter = applyCharacterBonuses(currentCharacter);
      saveSessionState();
      renderCharacter(currentCharacter);
      setLog(`Класс изменён на ${getClassName(nextClass)}. Фракция: ${getFactionName(nextFaction)}.`);
    };
  }

  if (logoutBtn) logoutBtn.onclick = logoutGame;

  gameStatus.textContent = `Игрок: ${safeC.name} • ${factionName} • ${className} • Уровень ${safeC.level}`;
  showGameScreen();
}

function renderCharacterList(list) {
  characterListDiv.innerHTML = '';

  if (!list || list.length === 0) {
    characterListDiv.innerHTML = '<p>Нет сохранённых героев.</p>';
    return;
  }

  list.forEach((char) => {
    const safeChar = applyCharacterBonuses({ ...char, faction: char.faction || 'light' });
    const factionClass = getFactionClass(safeChar.faction || 'light');
    const item = document.createElement('button');
    item.className = `character-item ${factionClass}`;
    item.innerHTML = `
      <strong>${safeChar.name}</strong>
      <div class="character-meta">${getClassName(safeChar.classId)} • ${getFactionName(safeChar.faction || 'light')} • LV ${safeChar.level}</div>
    `;

    item.onclick = async () => {
      const res = await api(`/api/character?id=${encodeURIComponent(char.id)}`);
      if (res.error) return alert(res.error);

      currentCharacter = applyCharacterBonuses({ ...res.character, faction: res.character.faction || 'light' });
      currentId = currentCharacter.id;
      saveSessionState();
      goToCityPage();
    };

    characterListDiv.appendChild(item);
  });
}

async function loadCharacters() {
  const res = await api('/api/characters');
  if (res.characters) renderCharacterList(res.characters);
}

async function createCharacter() {
  const nickname = newNicknameInput.value.trim();
  const classId = newClassInput.value;
  const faction = newFactionInput.value || 'light';
  const password = newPasswordInput.value.trim();

  if (!nickname) return alert('Введите уникальный ник');
  if (!password) return alert('Придумайте пароль');

  const res = await api('/api/registerCharacter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, classId, faction, password })
  });

  if (res.error) return alert(res.error);

  const nextCharacter = applyCharacterBonuses({ ...res.character, faction: res.character.faction || faction });
  currentCharacter = nextCharacter;
  currentId = currentCharacter.id;
  saveSessionState();
  goToCityPage();
}

async function loginCharacter() {
  const nickname = loginNicknameInput.value.trim();
  const password = loginPasswordInput.value.trim();

  if (!nickname || !password) return alert('Введите ник и пароль');

  const res = await api('/api/loginCharacter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, password })
  });

  if (res.error) return alert(res.error);

  const nextCharacter = applyCharacterBonuses({ ...res.character, faction: res.character.faction || 'light' });
  currentCharacter = nextCharacter;
  currentId = currentCharacter.id;
  saveSessionState();
  goToCityPage();
}

async function startSelectedGame() {
  if (!currentCharacter || !currentId) return alert('Сначала выберите или создайте персонажа');
  renderCharacter(currentCharacter);
  setActiveTab('profile');
  startGameBtn.classList.add('hidden');
}

async function travel(to) {
  if (!currentId) return alert('Сначала выберите героя');

  const res = await api('/api/travel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: currentId, to })
  });

  if (res.error) return alert(res.error);

  currentCharacter = applyCharacterBonuses({ ...res.character, faction: currentCharacter.faction || 'light' });
  saveSessionState();
  renderCharacter(currentCharacter);
  setLog(`Вы переместились в ${res.location.name}. ${res.location.description}`);
}

async function fight() {
  if (!currentId) return alert('Сначала выберите героя');

  const res = await api('/api/fight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: currentId })
  });

  if (res.error) return alert(res.error);

  if (res.log) setLog(res.log.join('\n'));

  const nextCharacter = currentCharacter ? { ...currentCharacter } : null;
  if (nextCharacter && nextCharacter.classId === 'healer') {
    const healValue = nextCharacter.faction === 'dark' ? 10 : 15;
    nextCharacter.hp = Math.min(nextCharacter.maxHp, nextCharacter.hp + healValue);
    appendLog(`\nЛекарь активировал исцеление: +${healValue} HP.`);
  }

  if (nextCharacter && nextCharacter.faction === 'dark') {
    appendLog('\nТёмная фракция усиливает тень в вашем ударе.');
  }

  if (res.character) {
    currentCharacter = applyCharacterBonuses({ ...res.character, faction: currentCharacter.faction || 'light' });

    if (nextCharacter && nextCharacter.classId === 'healer') {
      currentCharacter.hp = Math.min(currentCharacter.maxHp, currentCharacter.hp + 15);
    }

    saveSessionState();
    renderCharacter(currentCharacter);
  }

  if (res.victory === true) {
    appendLog('\nПобеда! Вы получили награду.');
  } else {
    appendLog('\nПоражение. Вы вернулись в город.');
  }
}

async function renderInventoryTab() {
  if (!currentId) {
    inventoryContent.innerHTML = '<p>Сначала выберите героя.</p>';
    return;
  }

  const res = await api(`/api/inventory?id=${encodeURIComponent(currentId)}`);
  if (res.error) {
    inventoryContent.innerHTML = `<p>${res.error}</p>`;
    return;
  }

  if (!res.inventory || res.inventory.length === 0) {
    inventoryContent.innerHTML = '<p>Инвентарь пуст.</p>';
    return;
  }

  inventoryContent.innerHTML = res.inventory.map((item, idx) => `
    <div class="item-row">
      <div class="item-name">${item.name} x${item.qty}</div>
      <button class="small-btn" data-use-index="${idx}">Использовать</button>
    </div>
  `).join('');

  inventoryContent.querySelectorAll('[data-use-index]').forEach((btn) => {
    btn.onclick = async () => {
      const idx = Number(btn.dataset.useIndex);
      const useRes = await api('/api/useItem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentId, idx })
      });

      if (useRes.error) return alert(useRes.error);
      setLog(useRes.message || 'Предмет использован');
      currentCharacter = applyCharacterBonuses({ ...useRes.character, faction: currentCharacter.faction || 'light' });
      saveSessionState();
      renderCharacter(currentCharacter);
      renderInventoryTab();
    };
  });
}

async function renderQuestsTab() {
  if (!currentId) {
    questsContent.innerHTML = '<p>Сначала выберите героя.</p>';
    return;
  }

  const res = await api(`/api/quests?id=${encodeURIComponent(currentId)}`);
  if (res.error) {
    questsContent.innerHTML = `<p>${res.error}</p>`;
    return;
  }

  if (!res.quests || res.quests.length === 0) {
    questsContent.innerHTML = '<p>Квестов нет.</p>';
    return;
  }

  questsContent.innerHTML = res.quests.map((q) => `
    <div class="quest-row">
      <div class="quest-name">
        <strong>${q.title}</strong><br>
        ${q.description}<br>
        ${q.progress}/${q.target} • ${q.done ? 'Выполнено' : 'В процессе'}
      </div>
    </div>
  `).join('');
}

async function renderShopTab() {
  if (!currentId) {
    shopContent.innerHTML = '<p>Сначала выберите героя.</p>';
    return;
  }

  shopContent.innerHTML = `
    <div class="shop-row">
      <div class="shop-name"><strong>Зелье лечения</strong><br>Восстанавливает 15 HP</div>
      <button class="small-btn" id="buyPotionBtn">Купить за 10 золота</button>
    </div>
  `;

  document.getElementById('buyPotionBtn').onclick = async () => {
    const res = await api('/api/buyPotion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentId })
    });

    if (res.error) return alert(res.error);
    setLog(res.message || 'Покупка совершена.');
    currentCharacter = applyCharacterBonuses({ ...res.character, faction: currentCharacter.faction || 'light' });
    saveSessionState();
    renderCharacter(currentCharacter);
    renderShopTab();
    renderInventoryTab();
  };
}

async function loadWorld() {
  const data = await api('/api/world');
  if (data.locations) {
    const buttons = [];
    data.locations.forEach((loc) => {
      const btn = document.createElement('button');
      btn.textContent = loc.name;
      btn.onclick = () => travel(loc.id);
      buttons.push(btn);
    });

    locationsDiv.innerHTML = '';
    buttons.forEach((btn) => locationsDiv.appendChild(btn));
  }
}

modeButtons.forEach((btn) => {
  btn.onclick = () => setAuthMode(btn.dataset.authMode);
});

createBtn.onclick = createCharacter;
loginBtn.onclick = loginCharacter;
startGameBtn.onclick = startSelectedGame;

fightBtn.onclick = fight;
invBtn.onclick = async () => {
  setActiveTab('inventory');
  await renderInventoryTab();
};
questBtn.onclick = async () => {
  setActiveTab('quests');
  await renderQuestsTab();
};
shopBtn.onclick = async () => {
  setActiveTab('shop');
  await renderShopTab();
};

tabButtons.forEach((btn) => {
  btn.onclick = async () => {
    const name = btn.dataset.tab;
    setActiveTab(name);

    if (name === 'inventory') await renderInventoryTab();
    if (name === 'quests') await renderQuestsTab();
    if (name === 'shop') await renderShopTab();
    if (name === 'profile') renderCharacter(currentCharacter);
  };
});

async function restoreSession() {
  const restored = restoreSessionState();

  if (!restored) {
    setLog('Добро пожаловать. Создайте героя или войдите по нику и паролю.');
    showAuthScreen();
    setAuthMode('register');
    setActiveTab('profile');
    startGameBtn.classList.add('hidden');
    return;
  }

  renderCharacter(currentCharacter);
  setActiveTab('profile');
  setLog(`Сессия восстановлена: ${currentCharacter.name}`);
  startGameBtn.classList.add('hidden');
}

const params = new URLSearchParams(window.location.search);
const mode = params.get('mode');

if (mode === 'forest') {
  setActiveTab('profile');
  setLog('Вы вошли в лес');
}
if (mode === 'shop') {
  setActiveTab('shop');
  renderShopTab();
}
if (mode === 'inventory') {
  setActiveTab('inventory');
  renderInventoryTab();
}
if (mode === 'quests') {
  setActiveTab('quests');
  renderQuestsTab();
}
if (mode === 'profile') {
  setActiveTab('profile');
  renderCharacter(currentCharacter);
}

loadWorld();
loadCharacters();
restoreSession();
