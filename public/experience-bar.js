const EXPERIENCE_STORAGE_KEY = 'rpg_current_character';
let lastExperienceLevel = null;
let levelUpTimer = null;

function triggerLevelUpAnimation() {
  const fill = document.querySelector('.experience-bar-fill');
  if (!fill) return;

  fill.classList.remove('level-up');
  void fill.offsetWidth;
  fill.classList.add('level-up');
  window.clearTimeout(levelUpTimer);
  levelUpTimer = window.setTimeout(() => fill.classList.remove('level-up'), 900);
}

function updateExperienceBar(currentExp, maxExp, level) {
  const container = document.querySelector('.experience-bar-container');
  const fill = document.querySelector('.experience-bar-fill');
  const percentageLabel = document.querySelector('.experience-percentage');
  if (!container || !fill || !percentageLabel) return;

  const current = Number(currentExp);
  const maximum = Number(maxExp);
  const percentage = Number.isFinite(current) && Number.isFinite(maximum) && maximum > 0
    ? Math.min(100, Math.max(0, (current / maximum) * 100))
    : 0;
  const roundedPercentage = Math.round(percentage);

  fill.style.width = `${percentage}%`;
  percentageLabel.textContent = `${roundedPercentage}%`;
  container.setAttribute('aria-valuenow', String(roundedPercentage));

  const nextLevel = level == null ? NaN : Number(level);
  if (Number.isFinite(nextLevel)) {
    if (lastExperienceLevel !== null && nextLevel > lastExperienceLevel) {
      triggerLevelUpAnimation();
    }
    lastExperienceLevel = nextLevel;
  }
}

function updateExperienceBarFromStorage() {
  try {
    const character = JSON.parse(localStorage.getItem(EXPERIENCE_STORAGE_KEY) || 'null');
    if (character) {
      updateExperienceBar(character.xp, character.xpToNext, character.level);
      return;
    }
  } catch {
    // Ignore invalid saved character data and show an empty bar.
  }
  updateExperienceBar(0, 1, null);
}

window.updateExperienceBar = updateExperienceBar;
window.triggerLevelUpAnimation = triggerLevelUpAnimation;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateExperienceBarFromStorage, { once: true });
} else {
  updateExperienceBarFromStorage();
}
window.addEventListener('storage', updateExperienceBarFromStorage);
