const TOWERS_STORAGE_KEY = 'rpg_towers_state';
const TOWERS_CHARACTER_KEY = 'rpg_current_character';
const TOWERS_CHARACTER_ID_KEY = 'rpg_current_id';
const TOWERS_PLAYERS_KEY = 'rpg_towers_players';
const TOWER_FACTIONS = {
  union: { id: 'union', name: 'Союз', color: '#4169E1' },
  empire: { id: 'empire', name: 'Империя', color: '#DC143C' }
};
const TOWER_REWARDS = {
  capture: { xp: 500, gold: 1000, reputation: 50 },
  damage: { xp: 100, gold: 200, reputation: 10 },
  repair: { xp: 50, gold: 0, reputation: 5 }
};
const TOWER_REPAIR_COST = 100;
const TOWER_CAPTURE_RESTORE = 0.3;
const TOWER_HISTORY_LIMIT = 50;

const DEFAULT_TOWERS = [
  { id: 1, name: 'Башня Северного Стража', faction: 'union', maxHp: 1000, location: 'Север', x: 250, y: 50, goldPerHour: 100 },
  { id: 2, name: 'Башня Южной Цитадели', faction: 'empire', maxHp: 1000, location: 'Юг', x: 250, y: 450, goldPerHour: 100 },
  { id: 3, name: 'Башня Запада', faction: 'union', maxHp: 900, location: 'Запад', x: 50, y: 250, goldPerHour: 90 },
  { id: 4, name: 'Башня Востока', faction: 'empire', maxHp: 900, location: 'Восток', x: 450, y: 250, goldPerHour: 90 },
  { id: 5, name: 'Центральная крепость', faction: 'union', maxHp: 1200, location: 'Центр', x: 250, y: 250, goldPerHour: 150 },
  { id: 6, name: 'Башня Предателя', faction: 'union', maxHp: 800, location: 'Холмы', x: 130, y: 130, goldPerHour: 80 },
  { id: 7, name: 'Башня Тьмы', faction: 'empire', maxHp: 1100, location: 'Тёмный лес', x: 370, y: 130, goldPerHour: 110 },
  { id: 8, name: 'Башня Света', faction: 'union', maxHp: 1050, location: 'Долина', x: 130, y: 370, goldPerHour: 105 },
  { id: 9, name: 'Башня Теней', faction: 'empire', maxHp: 950, location: 'Пещеры', x: 370, y: 370, goldPerHour: 95 },
  { id: 10, name: 'Башня Края Света', faction: 'union', maxHp: 850, location: 'Край Света', x: 450, y: 450, goldPerHour: 85 }
].map((tower) => ({ ...tower, hp: tower.maxHp, captureHistory: [] }));

function towersReadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function towersLoadState() {
  const saved = towersReadJson(TOWERS_STORAGE_KEY, null);
  if (saved && Array.isArray(saved.towers) && saved.towers.length) return saved;
  return { towers: JSON.parse(JSON.stringify(DEFAULT_TOWERS)), captures: [] };
}

function towersSaveState(state) {
  localStorage.setItem(TOWERS_STORAGE_KEY, JSON.stringify(state));
}

function towersLoadPlayers() {
  return towersReadJson(TOWERS_PLAYERS_KEY, {});
}

function getCurrentCharacter() {
  return towersReadJson(TOWERS_CHARACTER_KEY, null);
}

function getPlayerFaction(character = getCurrentCharacter()) {
  return character?.faction === 'dark' ? 'empire' : 'union';
}

function getTowers() {
  return towersLoadState().towers;
}

function getTowerById(id) {
  return getTowers().find((tower) => tower.id === Number(id)) || null;
}

function getPlayerStats(character = getCurrentCharacter()) {
  const players = towersLoadPlayers();
  const key = character ? String(character.id ?? character.name) : '';
  return players[key] || { name: character?.name || '', captures: 0, damageDealt: 0, repairs: 0, reputation: 0 };
}

function towersGrantRewards(character, reward, goldDelta = reward.gold) {
  character.xp = (Number(character.xp) || 0) + reward.xp;
  character.gold = (Number(character.gold) || 0) + goldDelta;
  while (character.xpToNext > 0 && character.xp >= character.xpToNext) {
    character.xp -= character.xpToNext;
    character.level = (Number(character.level) || 1) + 1;
    character.xpToNext = Math.round(character.xpToNext * 1.4);
  }
  localStorage.setItem(TOWERS_CHARACTER_KEY, JSON.stringify(character));
  if (typeof window !== 'undefined') window.updateExperienceBar?.(character.xp, character.xpToNext, character.level);
}

function towersUpdatePlayer(character, mutate) {
  const players = towersLoadPlayers();
  const key = String(character.id ?? character.name);
  const stats = players[key] || { name: character.name, captures: 0, damageDealt: 0, repairs: 0, reputation: 0 };
  stats.name = character.name;
  mutate(stats);
  players[key] = stats;
  localStorage.setItem(TOWERS_PLAYERS_KEY, JSON.stringify(players));
}

function attackTower(towerId, damage) {
  const character = getCurrentCharacter();
  if (!character) return { success: false, message: 'Персонаж не найден' };
  const dmg = Math.floor(Number(damage));
  if (!Number.isFinite(dmg) || dmg <= 0) return { success: false, message: 'Некорректный урон' };

  const state = towersLoadState();
  const tower = state.towers.find((t) => t.id === Number(towerId));
  if (!tower) return { success: false, message: 'Башня не найдена' };
  const faction = getPlayerFaction(character);
  if (tower.faction === faction) return { success: false, message: 'Нельзя атаковать свою башню' };

  tower.hp = Math.max(0, tower.hp - dmg);
  const captured = tower.hp <= 0;
  let reward = TOWER_REWARDS.damage;
  if (captured) {
    reward = TOWER_REWARDS.capture;
    const previousOwner = tower.faction;
    tower.faction = faction;
    tower.hp = Math.max(1, Math.round(tower.maxHp * TOWER_CAPTURE_RESTORE));
    const entry = { towerId: tower.id, towerName: tower.name, player: character.name, faction, from: previousOwner, date: new Date().toISOString() };
    tower.captureHistory = [entry, ...(tower.captureHistory || [])].slice(0, TOWER_HISTORY_LIMIT);
    state.captures = [entry, ...(state.captures || [])].slice(0, TOWER_HISTORY_LIMIT);
  }
  towersSaveState(state);
  towersGrantRewards(character, reward);
  towersUpdatePlayer(character, (stats) => {
    stats.damageDealt += dmg;
    stats.reputation += reward.reputation;
    if (captured) stats.captures += 1;
  });
  return {
    success: true,
    captured,
    tower,
    reward,
    message: captured
      ? `Башня «${tower.name}» захвачена! +${reward.xp} опыта, +${reward.gold} золота, +${reward.reputation} репутации`
      : `Нанесено ${dmg} урона. +${reward.xp} опыта, +${reward.gold} золота, +${reward.reputation} репутации`
  };
}

function repairTower(towerId) {
  const character = getCurrentCharacter();
  if (!character) return { success: false, message: 'Персонаж не найден' };
  const state = towersLoadState();
  const tower = state.towers.find((t) => t.id === Number(towerId));
  if (!tower) return { success: false, message: 'Башня не найдена' };
  if (tower.faction !== getPlayerFaction(character)) return { success: false, message: 'Можно ремонтировать только свои башни' };
  if (tower.hp >= tower.maxHp) return { success: false, message: 'Башня уже в полном порядке' };
  if ((Number(character.gold) || 0) < TOWER_REPAIR_COST) return { success: false, message: `Нужно ${TOWER_REPAIR_COST} золота` };

  const before = tower.hp;
  tower.hp = Math.min(tower.maxHp, tower.hp + 50 + (Number(character.level) || 1) * 10);
  towersSaveState(state);
  towersGrantRewards(character, TOWER_REWARDS.repair, -TOWER_REPAIR_COST);
  towersUpdatePlayer(character, (stats) => {
    stats.repairs += 1;
    stats.reputation += TOWER_REWARDS.repair.reputation;
  });
  return {
    success: true,
    tower,
    message: `Башня отремонтирована (+${tower.hp - before} ХП). +${TOWER_REWARDS.repair.xp} опыта, +${TOWER_REWARDS.repair.reputation} репутации`
  };
}

function towersEstimateDamage(character = getCurrentCharacter()) {
  if (!character) return 0;
  return Math.round((Number(character.str) || 1) * 5 + (Number(character.level) || 1) * 10);
}

function updateFactionStats() {
  const towers = getTowers();
  const stats = {};
  Object.keys(TOWER_FACTIONS).forEach((id) => {
    const count = towers.filter((t) => t.faction === id).length;
    stats[id] = { count, percent: towers.length ? Math.round((count / towers.length) * 100) : 0 };
  });
  return stats;
}

function towersEscape(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

function towersFormatDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ru-RU');
}

function towersHealthPercent(tower) {
  return Math.max(0, Math.min(100, Math.round((tower.hp / tower.maxHp) * 100)));
}

function towersCardHtml(tower, withActions) {
  const factionInfo = TOWER_FACTIONS[tower.faction];
  const mine = tower.faction === getPlayerFaction();
  const actions = withActions
    ? `<div class="tower-actions">${mine
      ? `<button type="button" class="tower-btn" data-repair="${tower.id}">🔧 Ремонт (${TOWER_REPAIR_COST} 💰)</button>`
      : `<button type="button" class="tower-btn" data-attack="${tower.id}">⚔️ Атаковать</button>`}</div>`
    : '';
  return `
    <div class="tower-card ${tower.faction}" data-tower-id="${tower.id}">
      <div class="tower-card-header">
        <span class="tower-icon">🏰</span>
        <div><strong>${towersEscape(tower.name)}</strong><br><small>${towersEscape(factionInfo.name)} • ${towersEscape(tower.location)}</small></div>
      </div>
      <div class="tower-health"><div class="tower-health-fill ${tower.faction}" style="width:${towersHealthPercent(tower)}%"></div></div>
      <small>${tower.hp}/${tower.maxHp} ХП • ${tower.goldPerHour} 💰/час</small>
      ${actions}
    </div>`;
}

function renderTowersList(containerId = 'towersList', withActions = true) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = getTowers().map((tower) => towersCardHtml(tower, withActions)).join('');
}

function renderFactionComparison(containerId = 'factionComparison') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const stats = updateFactionStats();
  container.innerHTML = Object.values(TOWER_FACTIONS).map((faction) => `
    <div class="faction-war-card ${faction.id}">
      <h3>${faction.name}</h3>
      <p class="faction-war-count">${stats[faction.id].count} башен</p>
      <div class="tower-health"><div class="tower-health-fill ${faction.id}" style="width:${stats[faction.id].percent}%"></div></div>
      <small>${stats[faction.id].percent}% территории</small>
    </div>`).join('');
}

function renderRecentCaptures(containerId = 'recentCaptures') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const captures = (towersLoadState().captures || []).slice(0, 10);
  container.innerHTML = captures.length
    ? captures.map((c) => `<li><strong>${towersEscape(c.towerName)}</strong> — ${towersEscape(c.player)} (${towersEscape(TOWER_FACTIONS[c.faction]?.name)})<br><small>${towersEscape(towersFormatDate(c.date))}</small></li>`).join('')
    : '<li>Захватов пока не было</li>';
}

function renderTopPlayers(containerId = 'topPlayers') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const top = Object.values(towersLoadPlayers())
    .filter((p) => p.captures > 0)
    .sort((a, b) => b.captures - a.captures)
    .slice(0, 10);
  container.innerHTML = top.length
    ? top.map((p) => `<li>${towersEscape(p.name)} — ${p.captures} захватов</li>`).join('')
    : '<li>Рейтинг пока пуст</li>';
}

function towersShowMessage(text, isError) {
  const el = document.getElementById('towersMessage');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error', Boolean(isError));
}

function towersBindActions(refresh) {
  document.addEventListener('click', (event) => {
    const attack = event.target.closest('[data-attack]');
    const repair = event.target.closest('[data-repair]');
    if (!attack && !repair) return;
    const result = attack
      ? attackTower(attack.dataset.attack, towersEstimateDamage())
      : repairTower(repair.dataset.repair);
    towersShowMessage(result.message, !result.success);
    refresh();
  });
}

function drawTowersMap(selectedId) {
  const canvas = document.getElementById('towersCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1b2230';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  getTowers().forEach((tower) => {
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 16, 0, Math.PI * 2);
    ctx.fillStyle = TOWER_FACTIONS[tower.faction].color;
    ctx.fill();
    ctx.lineWidth = tower.id === selectedId ? 4 : 2;
    ctx.strokeStyle = tower.id === selectedId ? '#ffd700' : '#fff';
    ctx.stroke();
  });
}

function showTowerInfo(tower) {
  const info = document.getElementById('towerInfo');
  if (!info) return;
  info.innerHTML = tower ? towersCardHtml(tower, true) : '<p>Кликните на башню на карте</p>';
}

function initTowersMap() {
  let selectedId = null;
  const refresh = () => {
    drawTowersMap(selectedId);
    renderTowersList('towersList', true);
    showTowerInfo(selectedId ? getTowerById(selectedId) : null);
    const character = getCurrentCharacter();
    const el = document.getElementById('towersPlayer');
    if (el && character) {
      el.textContent = `${character.name} • ${TOWER_FACTIONS[getPlayerFaction(character)].name} • 💰 ${character.gold} • Урон: ${towersEstimateDamage(character)}`;
    }
  };
  const canvas = document.getElementById('towersCanvas');
  if (canvas) {
    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * (canvas.width / rect.width);
      const y = (event.clientY - rect.top) * (canvas.height / rect.height);
      const hit = getTowers().find((t) => Math.hypot(t.x - x, t.y - y) <= 20);
      selectedId = hit ? hit.id : null;
      refresh();
    });
  }
  towersBindActions(refresh);
  refresh();
}

function initFactionWar() {
  const render = () => {
    renderFactionComparison();
    renderRecentCaptures();
    renderTopPlayers();
    renderTowersList('towersGrid', false);
    const character = getCurrentCharacter();
    const personal = document.getElementById('personalStats');
    if (personal) {
      if (!character) {
        personal.textContent = 'Персонаж не найден';
      } else {
        const s = getPlayerStats(character);
        personal.innerHTML = `<p>${towersEscape(character.name)} — ${TOWER_FACTIONS[getPlayerFaction(character)].name}</p>
          <p>Репутация: ${s.reputation}</p><p>Захватов: ${s.captures}</p><p>Нанесено урона: ${s.damageDealt}</p><p>Ремонтов: ${s.repairs}</p>`;
      }
    }
  };
  render();
}

if (typeof module !== 'undefined') {
  module.exports = { getTowers, getTowerById, attackTower, repairTower, updateFactionStats, getPlayerFaction, getPlayerStats };
}
