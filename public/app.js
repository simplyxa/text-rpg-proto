const api = (path, opts = {}) => fetch(path, opts).then(r=>r.json());

let currentName = null;
const nameInput = document.getElementById('name');
const classInput = document.getElementById('class');
const createBtn = document.getElementById('createBtn');
const loadBtn = document.getElementById('loadBtn');
const gameDiv = document.getElementById('game');
const statsDiv = document.getElementById('stats');
const logDiv = document.getElementById('log');
const travelTown = document.getElementById('travelTown');
const travelForest = document.getElementById('travelForest');
const travelCave = document.getElementById('travelCave');
const fightBtn = document.getElementById('fightBtn');
const invBtn = document.getElementById('invBtn');

function setLog(text) {
  logDiv.textContent = text + '\n\n' + logDiv.textContent;
}

function renderCharacter(c) {
  statsDiv.innerHTML = `
    <b>${c.name} (${c.classId})</b> LV ${c.level} XP ${c.xp}/${c.xpToNext}<br>
    HP: ${c.hp}/${c.maxHp} | STR:${c.str} AGI:${c.agi} INT:${c.int} | Gold: ${c.gold}<br>
    Локация: ${c.location}
  `;
  gameDiv.style.display = 'block';
}

createBtn.onclick = async () => {
  const name = nameInput.value.trim();
  const classId = classInput.value;
  if (!name) return alert('Введите имя');
  const res = await api('/api/createCharacter', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name, classId })
  });
  if (res.error) return alert(res.error);
  currentName = name;
  renderCharacter(res.character);
  setLog('Персонаж создан.');
};

loadBtn.onclick = async () => {
  const name = nameInput.value.trim();
  if (!name) return alert('Введите имя');
  const res = await api('/api/character?name=' + encodeURIComponent(name));
  if (res.error) return alert(res.error);
  currentName = name;
  renderCharacter(res.character);
  setLog('Персонаж загружен.');
};

travelTown.onclick = ()=>travel('town');
travelForest.onclick = ()=>travel('forest');
travelCave.onclick = ()=>travel('cave');

async function travel(to) {
  if (!currentName) return alert('Загрузите персонажа');
  const res = await api('/api/travel', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name: currentName, to })
  });
  if (res.error) return alert(res.error);
  renderCharacter(res.character);
  setLog(`Перемещение: ${res.location.name} — ${res.location.description}`);
}

fightBtn.onclick = async () => {
  if (!currentName) return alert('Загрузите персонажа');
  const res = await api('/api/fight', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name: currentName })
  });
  if (res.error) return alert(res.error);
  if (res.log) setLog(res.log.join('\n'));
  if (res.character) renderCharacter(res.character);
  if (res.message) setLog(res.message);
};

invBtn.onclick = async () => {
  if (!currentName) return alert('Загрузите персонажа');
  const res = await api('/api/inventory?name=' + encodeURIComponent(currentName));
  if (res.error) return alert(res.error);
  const inv = res.inventory;
  if (!inv || inv.length===0) return alert('Инвентарь пуст');
  const list = inv.map((it, i) => `${i}: ${it.name} x${it.qty || it.quantity || 1}`).join('\n');
  const idx = prompt('Инвентарь:\n' + list + '\n\nВведите индекс предмета чтобы использовать (отмена чтобы выйти)');
  if (idx === null) return;
  const n = parseInt(idx);
  if (isNaN(n) || n < 0 || n >= inv.length) return alert('Неверный индекс');
  const useRes = await api('/api/useItem', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name: currentName, idx: n })
  });
  if (useRes.error) return alert(useRes.error);
  setLog(useRes.message || 'Использован предмет');
  if (useRes.character) renderCharacter(useRes.character);
};
