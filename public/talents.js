const TALENT_CHARACTER_KEY = 'rpg_current_character';
const TALENT_ID_KEY = 'rpg_current_id';
let talentState;

function showTalentMessage(message) {
  document.getElementById('talentMessage').textContent = message || '';
}

async function requestTalents(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Не удалось загрузить таланты.');
  return result;
}

function renderTalents() {
  document.getElementById('talentPoints').textContent = talentState.talentPoints;
  const container = document.getElementById('talentTrees');
  container.replaceChildren();
  talentState.trees.forEach((tree) => {
    const section = document.createElement('section');
    section.className = 'talent-tree content-box';
    const heading = document.createElement('h2');
    heading.textContent = tree.name;
    section.append(heading);
    tree.talents.forEach((talent) => {
      const rank = Number(talentState.talents[talent.id]) || 0;
      const card = document.createElement('article');
      card.className = 'talent-card';
      const details = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = talent.name;
      const description = document.createElement('p');
      description.textContent = talent.description;
      const rankLabel = document.createElement('span');
      rankLabel.textContent = `Ранг ${rank}/${talent.maxRank}`;
      details.append(name, description, rankLabel);
      const button = document.createElement('button');
      button.className = 'small-btn';
      button.type = 'button';
      button.textContent = 'Улучшить';
      button.disabled = talentState.talentPoints < 1 || rank >= talent.maxRank;
      button.addEventListener('click', () => upgradeTalent(talent.id));
      card.append(details, button);
      section.append(card);
    });
    container.append(section);
  });
}

async function upgradeTalent(talentId) {
  try {
    const result = await requestTalents('/api/talents/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: localStorage.getItem(TALENT_ID_KEY), talentId })
    });
    talentState.talents = result.talents;
    talentState.talentPoints = result.talentPoints;
    localStorage.setItem(TALENT_CHARACTER_KEY, JSON.stringify(result.character));
    renderTalents();
    showTalentMessage('Талант улучшен.');
  } catch (error) {
    showTalentMessage(error.message);
  }
}

async function loadTalents() {
  const id = localStorage.getItem(TALENT_ID_KEY);
  if (!id) {
    window.location.href = '/';
    return;
  }
  try {
    talentState = await requestTalents(`/api/talents?id=${encodeURIComponent(id)}`);
    renderTalents();
  } catch (error) {
    showTalentMessage(error.message);
  }
}

loadTalents();
