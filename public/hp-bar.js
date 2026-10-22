const HP_STORAGE_KEY = 'rpg_current_character';

function renderHpBar() {
  let bar = document.getElementById('hpBar');
  let character = null;
  try {
    character = JSON.parse(localStorage.getItem(HP_STORAGE_KEY) || 'null');
  } catch {
    character = null;
  }
  if (!character) {
    if (bar) bar.remove();
    return;
  }

  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'hpBar';
    bar.className = 'hp-bar';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-label', 'Текущее здоровье');
    document.body.prepend(bar);
  }
  const hp = Number(character.hp) || 0;
  const maxHp = Number(character.maxHp) || hp;
  bar.textContent = `❤ ${hp}/${maxHp}`;
}

window.renderHpBar = renderHpBar;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderHpBar, { once: true });
} else {
  renderHpBar();
}
window.addEventListener('storage', renderHpBar);
