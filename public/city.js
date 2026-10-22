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
  } catch {
    clearSessionState();
    return null;
  }
}

function loadHero() {
  const hero = restoreSessionState();

  if (!hero) {
    window.location.href = '/';
    return null;
  }

  document.getElementById('heroName').textContent = hero.name;
  document.getElementById('cityTitle').textContent = hero.faction === 'dark' ? 'Тёмные' : 'Светлые';
  const hp = Number(hero.hp) || 0;
  document.getElementById('hubHp').textContent = `${hp}/${Number(hero.maxHp) || hp}`;
  document.getElementById('hubEnergy').textContent = Number(hero.mana) || 100;

  return hero;
}

document.addEventListener('DOMContentLoaded', () => {
  const hero = loadHero();
  if (!hero) return;

  document.querySelectorAll('[data-countdown]').forEach((timer) => {
    let secondsRemaining = Number(timer.dataset.countdown) || 0;
    const updateTimer = () => {
      const hours = String(Math.floor(secondsRemaining / 3600)).padStart(2, '0');
      const minutes = String(Math.floor((secondsRemaining % 3600) / 60)).padStart(2, '0');
      const seconds = String(secondsRemaining % 60).padStart(2, '0');
      timer.textContent = `${hours}:${minutes}:${seconds}`;
      secondsRemaining = Math.max(0, secondsRemaining - 1);
    };
    updateTimer();
    window.setInterval(updateTimer, 1000);
  });

  document.querySelectorAll('[data-hub-action]').forEach((button) => {
    button.onclick = () => {
      const action = button.dataset.hubAction;
      const routes = {
        tower: '/towers-map',
        forest: '/forest',
        cave: '/cave',
        quests: '/quests',
        shop: '/shop',
        character: '/character'
      };

      if (routes[action]) {
        window.location.href = routes[action];
        return;
      }

      document.getElementById('hubNotice').textContent = 'Этот раздел скоро появится в игре.';
    };
  });

  document.querySelectorAll('[data-action]').forEach((button) => {
    button.onclick = () => {
      const action = button.dataset.action;

      if (action === 'shop') window.location.href = '/shop';
      if (action === 'inventory') window.location.href = '/inventory';
      if (action === 'quests') window.location.href = '/quests';
      if (action === 'profile') window.location.href = '/character';
    };
  });
});
