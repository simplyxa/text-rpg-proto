const STORAGE_KEY = 'rpg_current_character';
const STORAGE_ID_KEY = 'rpg_current_id';
const MAX_LOG_LINES = 4;

const location_ = new URLSearchParams(window.location.search).get('location');
const fightLocation = location_ === 'cave' ? 'cave' : 'forest';

let heroId = null;
let battleLog = [];
let fightState = null;
let selectedTargetId = null;
let busy = false;

function loadHero() {
  try {
    const id = localStorage.getItem(STORAGE_ID_KEY);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!id || !saved || !saved.id) return null;
    return { id, ...saved };
  } catch {
    return null;
  }
}

function saveCharacter(character) {
  const current = loadHero() || {};
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...character }));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function updateBattleLog(message) {
  battleLog.unshift(message);
  battleLog = battleLog.slice(0, MAX_LOG_LINES);
  document.getElementById('battleLog').innerHTML = battleLog.map((line) => `<div class="log-line">${escapeHtml(line)}</div>`).join('');
}

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: heroId, location: fightLocation, ...body })
  });
  return res.json();
}

function statusText(phase) {
  if (phase === 'cleared') return 'Враг повержен!';
  if (phase === 'group_cleared') return 'Группа врагов повержена!';
  if (phase === 'boss_cleared') return 'Босс повержен! Вы победили пещеру!';
  if (phase === 'defeated') return fightLocation === 'cave' ? 'Вы повержены в пещере!' : 'Вы повержены!';
  if (phase === 'boss') return 'Битва с боссом';
  return fightLocation === 'cave' ? 'Пещера' : 'Лес';
}

function renderEnemies() {
  const box = document.getElementById('enemies');
  const alive = fightState.enemies.filter((e) => e.hp > 0);
  if (!alive.some((e) => e.id === selectedTargetId)) selectedTargetId = alive.length ? alive[0].id : null;

  box.innerHTML = fightState.enemies.map((enemy) => {
    const classes = ['enemy-card'];
    if (enemy.hp <= 0) classes.push('dead');
    if (enemy.id === selectedTargetId) classes.push('selected');
    return `<div class="${classes.join(' ')}" data-id="${escapeHtml(enemy.id)}">
      <strong>${escapeHtml(enemy.name)}</strong>
      <span>HP: ${enemy.hp}/${enemy.maxHp}</span>
      <span>Урон: ${enemy.atk}</span>
    </div>`;
  }).join('');

  box.querySelectorAll('.enemy-card').forEach((card) => {
    card.onclick = () => {
      const enemy = fightState.enemies.find((e) => e.id === card.dataset.id);
      if (!enemy || enemy.hp <= 0) return;
      selectedTargetId = enemy.id;
      renderEnemies();
    };
  });
}

function renderButtons() {
  const phase = fightState.phase;
  const buttons = [];
  if (phase === 'fight' || phase === 'boss') buttons.push(['Атаковать', attack, 'primary-btn']);
  if (phase === 'cleared') {
    buttons.push(['Найти нового врага', startFight, 'primary-btn']);
    buttons.push(['В город', leave, 'secondary-btn']);
  }
  if (phase === 'group_cleared') buttons.push(['Встретить Босса', startBoss, 'primary-btn']);
  if (phase === 'boss_cleared') {
    buttons.push(['Забрать награду', claimReward, 'primary-btn']);
    buttons.push(['В город', leave, 'secondary-btn']);
  }
  if (phase === 'defeated') {
    buttons.push(['Восстановиться', recover, 'primary-btn']);
    buttons.push(['В город', leave, 'secondary-btn']);
  }
  buttons.push(['Сбежать', leave, 'secondary-btn']);

  const row = document.getElementById('fightButtons');
  row.innerHTML = '';
  buttons.forEach(([label, handler, cls]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = cls;
    btn.textContent = label;
    btn.onclick = async () => {
      if (busy) return;
      busy = true;
      try {
        await handler();
      } finally {
        busy = false;
      }
    };
    row.appendChild(btn);
  });
}

function render() {
  document.getElementById('fightLocation').textContent = fightLocation === 'cave' ? 'Пещера' : 'Лес';
  document.getElementById('fightStatus').textContent = statusText(fightState.phase);
  renderEnemies();
  renderButtons();
}

function applyResponse(res) {
  if (res.error) {
    updateBattleLog(res.error);
    return false;
  }
  fightState = { phase: res.phase, enemies: res.enemies };
  saveCharacter(res.character);
  res.log.forEach(updateBattleLog);
  render();
  return true;
}

async function startFight() {
  const res = await fetch(`/api/fight?id=${encodeURIComponent(heroId)}&location=${fightLocation}&action=start`).then((r) => r.json());
  applyResponse(res);
}

async function startBoss() {
  applyResponse(await post('/api/fight/boss', {}));
}

async function attack() {
  applyResponse(await post('/api/fight/attack', { targetId: selectedTargetId }));
}

async function leave() {
  const res = await post('/api/fight/flee', {});
  if (res.character) saveCharacter(res.character);
  window.location.href = '/city';
}

async function recover() {
  const res = await post('/api/fight/defeat', {});
  if (res.error) return updateBattleLog(res.error);
  saveCharacter(res.character);
  window.location.href = '/city';
}

async function claimReward() {
  const res = await post('/api/fight/bosses/defeat', {});
  if (res.error) return updateBattleLog(res.error);
  saveCharacter(res.character);
  window.location.href = '/city';
}

document.addEventListener('DOMContentLoaded', async () => {
  const hero = loadHero();
  if (!hero) {
    window.location.href = '/';
    return;
  }
  heroId = hero.id;
  await startFight();
});
