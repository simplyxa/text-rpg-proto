const QUEST_CHARACTER_KEY = 'rpg_current_character';
const QUEST_CHARACTER_ID_KEY = 'rpg_current_id';

let characterId;
let dailyQuests = [];

function setQuestMessage(message) {
  document.getElementById('questMessage').textContent = message || '';
}

function createQuestCard(quest) {
  const card = document.createElement('article');
  card.className = 'daily-quest-card';

  const header = document.createElement('div');
  header.className = 'daily-quest-header';
  const title = document.createElement('h3');
  title.textContent = quest.name;
  const status = document.createElement('span');
  status.className = `daily-quest-status ${quest.status}`;
  status.textContent = ({ active: 'Активен', completed: 'Завершён', skipped: 'Пропущен' })[quest.status];
  header.append(title, status);

  const description = document.createElement('p');
  description.className = 'daily-quest-description';
  description.textContent = quest.description;

  const progress = document.createElement('div');
  progress.className = 'daily-quest-progress';
  const progressInfo = document.createElement('div');
  progressInfo.className = 'daily-quest-progress-info';
  const count = document.createElement('span');
  count.textContent = `${quest.progress} / ${quest.required}`;
  const percentage = document.createElement('span');
  const progressPercent = Math.round((quest.progress / quest.required) * 100);
  percentage.textContent = `${progressPercent}%`;
  progressInfo.append(count, percentage);
  const progressBar = document.createElement('div');
  progressBar.className = 'daily-quest-progress-bar';
  progressBar.setAttribute('role', 'progressbar');
  progressBar.setAttribute('aria-valuemin', '0');
  progressBar.setAttribute('aria-valuemax', String(quest.required));
  progressBar.setAttribute('aria-valuenow', String(quest.progress));
  const progressFill = document.createElement('div');
  progressFill.className = 'daily-quest-progress-fill';
  progressFill.style.width = `${progressPercent}%`;
  progressBar.append(progressFill);
  progress.append(progressInfo, progressBar);

  const reward = document.createElement('div');
  reward.className = 'daily-quest-reward';
  const experience = document.createElement('span');
  experience.className = 'quest-reward-exp';
  experience.textContent = `Опыт: +${quest.reward.experience}`;
  const gold = document.createElement('span');
  gold.className = 'quest-reward-gold';
  gold.textContent = `Золото: +${quest.reward.gold}`;
  reward.append(experience, gold);

  card.append(header, description, progress, reward);
  if (quest.status === 'active') {
    const actions = document.createElement('div');
    actions.className = 'daily-quest-actions';
    const completeButton = document.createElement('button');
    completeButton.type = 'button';
    completeButton.textContent = 'Получить награду';
    completeButton.disabled = quest.progress < quest.required;
    completeButton.addEventListener('click', () => performQuestAction('complete', quest.id));
    const skipButton = document.createElement('button');
    skipButton.type = 'button';
    skipButton.className = 'daily-quest-skip';
    skipButton.textContent = 'Пропустить';
    skipButton.addEventListener('click', () => performQuestAction('skip', quest.id));
    actions.append(completeButton, skipButton);
    card.append(actions);
  }
  return card;
}

function renderQuestSection(containerId, quests, emptyMessage) {
  const container = document.getElementById(containerId);
  container.replaceChildren();
  if (!quests.length) {
    const empty = document.createElement('p');
    empty.className = 'daily-quest-empty';
    empty.textContent = emptyMessage;
    container.append(empty);
    return;
  }
  quests.forEach((quest) => container.append(createQuestCard(quest)));
}

function renderQuestsPage(questStats) {
  const active = dailyQuests.filter((quest) => quest.status === 'active');
  const completed = dailyQuests.filter((quest) => quest.status === 'completed');
  const skipped = dailyQuests.filter((quest) => quest.status === 'skipped');
  renderQuestSection('activeQuestsList', active, 'Активных квестов нет.');
  renderQuestSection('completedQuestsList', completed, 'Завершённых квестов пока нет.');
  renderQuestSection('skippedQuestsList', skipped, 'Пропущенных квестов нет.');
  document.getElementById('streakDays').textContent = questStats.streakDays;
  const date = new Date();
  document.getElementById('currentDate').textContent = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
  document.getElementById('currentDate').dateTime = date.toISOString();
}

async function requestDailyQuests(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Не удалось загрузить квесты.');
  if (result.character) {
    localStorage.setItem(QUEST_CHARACTER_KEY, JSON.stringify(result.character));
    characterId = result.character.id || characterId;
  }
  dailyQuests = result.dailyQuests || dailyQuests;
  renderQuestsPage(result.questStats);
}

async function loadQuestsPage() {
  characterId = localStorage.getItem(QUEST_CHARACTER_ID_KEY);
  if (!characterId) {
    window.location.href = '/';
    return;
  }
  try {
    await requestDailyQuests(`/api/daily-quests?id=${encodeURIComponent(characterId)}`);
  } catch (error) {
    setQuestMessage(error.message);
  }
}

async function performQuestAction(action, questId) {
  try {
    await requestDailyQuests(`/api/daily-quests/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: characterId, questId })
    });
    setQuestMessage(action === 'complete' ? 'Награда получена!' : 'Квест пропущен.');
  } catch (error) {
    setQuestMessage(error.message);
  }
}

document.addEventListener('DOMContentLoaded', loadQuestsPage);
