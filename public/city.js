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

  return hero;
}

document.addEventListener('DOMContentLoaded', () => {
  const hero = loadHero();
  if (!hero) return;

  document.querySelectorAll('[data-action]').forEach((button) => {
    button.onclick = () => {
      const action = button.dataset.action;

      if (action === 'shop') window.location.href = '/shop';
      if (action === 'inventory') window.location.href = '/inventory';
      if (action === 'quests') window.location.href = '/?mode=quests';
      if (action === 'profile') window.location.href = '/character';
    };
  });
});
