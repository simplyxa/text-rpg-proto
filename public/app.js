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

const fightBtn = document.getElementById('fightBtn');
const invBtn = document.getElementById('invBtn');
const questBtn = document.getElementById('questBtn');
const shopBtn = document.getElementById('shopBtn');

function setLog(text) {
  logDiv.textContent = text;
}

function appendLog(text) {
  logDiv.textContent = (logDiv.textContent ? logDiv.textContent + '\n\n' : '') + text;
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

async function showInventory() {
  if (!currentId) return alert('Сначала выберите героя');

  const res = await api(`/api/inventory?id=${encodeURIComponent(currentId)}`);
  if (res.error) return alert(res.error);

  if (!res.inventory || res.inventory.length === 0) {
    setLog('Инвентарь пуст.');
    return;
  }

  const list = res.inventory.map((item, idx) => `${idx}: ${item.name} x${item.qty || 1}`).join('\n');
  const selected = prompt(`Инвентарь:\n${list}\n\nВведите номер предмета для использования:`);
  if (selected === null) return;

  const idx = Number(selected);
  if (Number.isNaN(idx) || idx < 0 || idx >= res.inventory.length) {
    alert('Неверный индекс');
    return;
  }

  const useRes = await api('/api/useItem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: currentId, idx })
  });

  if (useRes.error) return alert(useRes.error);

  setLog(useRes.message || 'Предмет использован');
  renderCharacter(useRes.character);
}

async function showQuests() {
  if (!currentId) return alert('Сначала выберите героя');

  const res = await api(`/api/quests?id=${encodeURIComponent(currentId)}`);
  if (res.error) return alert(res.error);

  const questText = res.quests.map((q, idx) =>
    `${idx + 1}. ${q.title} — ${q.progress}/${q.target} ${q.done ? '(выполнено)' : '(в процессе)'}`
  ).join('\n');

  setLog(questText || 'Квестов нет.');
}

async function showShop() {
  if (!currentId) return alert('Сначала выберите героя');

  const confirmBuy = confirm('Магазин:\n- Зелье лечения: 10 золота\n\nКупить зелье?');
  if (!confirmBuy) return;

  const res = await api('/api/buyPotion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: currentId })
  });

  if (res.error) return alert(res.error);

  setLog(res.message || 'Покупка совершена.');
  renderCharacter(res.character);
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
invBtn.onclick = showInventory;
questBtn.onclick = showQuests;
shopBtn.onclick = showShop;

loadWorld();
loadCharacters();
setLog('Добро пожаловать. Создайте или выберите героя.');
