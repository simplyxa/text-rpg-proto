const api = (url, options = {}) => fetch(url, options).then(r => r.json());

let currentId = null;
let currentCharacter = null;

const nameInput = document.getElementById('name');
const classInput = document.getElementById('class');
const createBtn = document.getElementById('createBtn');

const gameDiv = document.getElementById('game');
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

function renderCharacter(c) {
  currentCharacter = c;
  currentId = c.id;

  statsDiv.innerHTML = `
    <strong>${c.name}</strong> (${c.classId})<br>
    Уровень: ${c.level}<br>
    HP: ${c.hp}/${c.maxHp}<br>
    Сила: ${c.str} | Ловкость: ${c.agi} | Интеллект: ${c.int}<br>
    Опыт: ${c.xp}/${c.xpToNext}<br>
    Золото: ${c.gold}<br>
    Локация: ${c.location}
  `;

  profileContent.innerHTML = `
    <h3>Профиль героя</h3>
    <p><strong>Имя:</strong> ${c.name}</p>
    <p><strong>Класс:</strong> ${c.classId}</p>
    <p><strong>Уровень:</strong> ${c.level}</p>
    <p><strong>HP:</strong> ${c.hp}/${c.maxHp}</p>
    <p><strong>Сила:</strong> ${c.str}</p>
    <p><strong>Ловкость:</strong> ${c.agi}</p>
    <p><strong>Интеллект:</strong> ${c.int}</p>
    <p><strong>Опыт:</strong> ${c.xp}/${c.xpToNext}</p>
    <p><strong>Золото:</strong> ${c.gold}</p>
    <p><strong>Локация:</strong> ${c.location}</p>
  `;

  gameStatus.textContent = `Игрок: ${c.name} • ${c.location} • Уровень ${c.level}`;
  gameDiv.classList.remove('hidden');
}

function renderCharacterList(list) {
  characterListDiv.innerHTML = '';

  if (!list || list.length === 0) {
    characterListDiv.innerHTML = '<p>Нет сохранённых героев</p>';
    return;
  }

  list.forEach((char) => {
    const item = document.createElement('button');
    item.className = 'character-item';
    item.textContent = `${char.name} • ${char.classId} • LV ${char.level}`;
    item.onclick = async () => {
      const res = await api(`/api/character?id=${encodeURIComponent(char.id)}`);
      if (res.error) return alert(res.error);
      renderCharacter(res.character);
      setActiveTab('profile');
      setLog('Герой загружен.');
    };
    characterListDiv.appendChild(item);
  });
}

async function loadCharacters() {
  const res = await api('/api/characters');
  if (res.characters) {
    renderCharacterList(res.characters);
  }
}

async function createCharacter() {
  const name = nameInput.value.trim();
  const classId = classInput.value;

  if (!name) return alert('Введите имя героя');

  const res = await api('/api/createCharacter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, classId })
  });

  if (res.error) return alert(res.error);

  currentId = res.character.id;
  renderCharacter(res.character);
  setActiveTab('profile');
  setLog('Персонаж создан. Добро пожаловать в мир.');
  await loadCharacters();
}

async function travel(to) {
  if (!currentId) return alert('Сначала выберите героя');

  const res = await api('/api/travel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: currentId, to })
  });

  if (res.error) return alert(res.error);

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
  if (res.character) renderCharacter(res.character);

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
    renderCharacter(res.character);
    renderShopTab();
    renderInventoryTab();
  };
}

async function refreshTabs() {
  if (!currentId) return;
  await renderInventoryTab();
  await renderQuestsTab();
  await renderShopTab();
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

createBtn.onclick = createCharacter;
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
  };
});

loadWorld();
loadCharacters();
setLog('Добро пожаловать. Создайте или выберите героя.');
setActiveTab('profile');
