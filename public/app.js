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

function getClassName(classId) {
  return CLASS_NAMES[classId] || classId || 'Воин';
}

function getFactionName(factionId) {
  return FACTION_NAMES[factionId] || factionId || 'Светлые';
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
    currentCharacter = parsed;
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
  currentCharacter = c;
  currentId = c.id;
  saveSessionState();

  const className = getClassName(c.classId);
  const factionName = getFactionName(c.faction || 'light');

  statsDiv.innerHTML = `
    <strong>${c.name}</strong> (${className})<br>
    Фракция: ${factionName}<br>
    Уровень: ${c.level}<br>
    HP: ${c.hp}/${c.maxHp}<br>
    Сила: ${c.str} | Ловкость: ${c.agi} | Интеллект: ${c.int}<br>
    Опыт: ${c.xp}/${c.xpToNext}<br>
    Золото: ${c.gold}<br>
    Локация: ${c.location}
  `;

  profileContent.innerHTML = `
    <h3>Профиль героя</h3>
    <p><strong>Ник:</strong> ${c.name}</p>
    <p><strong>Класс:</strong> ${className}</p>
    <p><strong>Фракция:</strong> ${factionName}</p>
    <p><strong>Уровень:</strong> ${c.level}</p>
    <p><strong>HP:</strong> ${c.hp}/${c.maxHp}</p>
    <p><strong>Сила:</strong> ${c.str}</p>
    <p><strong>Ловкость:</strong> ${c.agi}</p>
    <p><strong>Интеллект:</strong> ${c.int}</p>
    <p><strong>Опыт:</strong> ${c.xp}/${c.xpToNext}</p>
    <p><strong>Золото:</strong> ${c.gold}</p>
    <p><strong>Локация:</strong> ${c.location}</p>

    <label>
      <span>Сменить класс</span>
      <select id="classSelect">
        <option value="warrior" ${c.classId === 'warrior' ? 'selected' : ''}>Воин</option>
        <option value="healer" ${c.classId === 'healer' ? 'selected' : ''}>Лекарь</option>
        <option value="mage" ${c.classId === 'mage' ? 'selected' : ''}>Маг</option>
      </select>
    </label>

    <label>
      <span>Сменить фракцию</span>
      <select id="factionSelect">
        <option value="light" ${(c.faction || 'light') === 'light' ? 'selected' : ''}>Светлые</option>
        <option value="dark" ${(c.faction || 'light') === 'dark' ? 'selected' : ''}>Тёмные</option>
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
      saveSessionState();
      renderCharacter(currentCharacter);
      setLog(`Класс изменён на ${getClassName(nextClass)}. Фракция: ${getFactionName(nextFaction)}.`);
    };
  }

  if (logoutBtn) logoutBtn.onclick = logoutGame;

  gameStatus.textContent = `Игрок: ${c.name} • ${getFactionName(c.faction || 'light')} • ${className} • Уровень ${c.level}`;
  showGameScreen();
}

function renderCharacterList(list) {
  characterListDiv.innerHTML = '';

  if (!list || list.length === 0) {
    characterListDiv.innerHTML = '<p>Нет сохранённых героев.</p>';
    return;
  }

  list.forEach((char) => {
    const item = document.createElement('button');
    item.className = 'character-item';
    item.innerHTML = `
      <strong>${char.name}</strong>
      <div class="character-meta">${getClassName(char.classId)} • ${getFactionName(char.faction || 'light')} • LV ${char.level}</div>
    `;

    item.onclick = async () => {
      const res = await api(`/api/character?id=${encodeURIComponent(char.id)}`);
      if (res.error) return alert(res.error);

      currentCharacter = res.character;
      currentId = res.character.id;
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
  const faction = newFactionInput.value;
  const password = newPasswordInput.value.trim();

  if (!nickname) return alert('Введите уникальный ник');
  if (!password) return alert('Придумайте пароль');

  const res = await api('/api/registerCharacter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, classId, faction, password })
  });

  if (res.error) return alert(res.error);

  currentCharacter = res.character;
  currentId = res.character.id;
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

  currentCharacter = res.character;
  currentId = res.character.id;
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

  currentCharacter = res.character;
  saveSessionState();
  renderCharacter(res.character);
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
  if (res.character) {
    currentCharacter = res.character;
    saveSessionState();
    renderCharacter(res.character);
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
      currentCharacter = useRes.character;
      saveSessionState();
      renderCharacter(useRes.character);
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
    currentCharacter = res.character;
    saveSessionState();
    renderCharacter(res.character);
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
