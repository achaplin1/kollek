const socket = io();

const landing = document.getElementById('landing');
const gameShell = document.getElementById('game-shell');
const themeToggle = document.getElementById('theme-toggle');
const createForm = document.getElementById('create-room-form');
const joinForm = document.getElementById('join-room-form');
const roomIdLabel = document.getElementById('room-id');
const shareLink = document.getElementById('share-link');
const copyLinkButton = document.getElementById('copy-link');
const openSetupButton = document.getElementById('open-setup');
const setupDialog = document.getElementById('setup-dialog');
const closeSetupButton = document.getElementById('close-setup');
const headForm = document.getElementById('head-form');
const questionForm = document.getElementById('question-form');
const headNameInput = document.getElementById('head-name');
const headImageInput = document.getElementById('head-image');
const questionInput = document.getElementById('question-input');
const headsList = document.getElementById('heads-list');
const questionList = document.getElementById('question-list');
const playerList = document.getElementById('player-list');
const stageHeads = document.getElementById('stage-heads');
const questionText = document.getElementById('question-text');
const roundBadge = document.getElementById('round-badge');
const statusMessage = document.getElementById('status-message');
const adminControls = document.getElementById('admin-controls');
const nextRoundButton = document.getElementById('next-round');
const votePanel = document.getElementById('vote-panel');
const submitVoteButton = document.getElementById('submit-vote');
const primarySlot = document.querySelector('.vote-card.primary');
const secondarySlot = document.querySelector('.vote-card.secondary');
const primaryName = document.getElementById('primary-name');
const secondaryName = document.getElementById('secondary-name');
const primaryImage = primarySlot.querySelector('img');
const secondaryImage = secondarySlot.querySelector('img');
const primaryPlaceholder = primarySlot.querySelector('.placeholder');
const secondaryPlaceholder = secondarySlot.querySelector('.placeholder');
const podium = document.getElementById('podium');
const resultsList = document.getElementById('results-list');
const confettiContainer = document.getElementById('confetti');
const suspenseOverlay = document.getElementById('suspense-overlay');
const tickerImage = document.getElementById('ticker-image');
const tickerName = document.getElementById('ticker-name');
const headTemplate = document.getElementById('head-card-template');
const headCollectionsList = document.getElementById('head-collections');
const headCollectionForm = document.getElementById('head-collection-form');
const headCollectionNameInput = document.getElementById('head-collection-name');
const questionCollectionsList = document.getElementById('question-collections');
const questionCollectionForm = document.getElementById('question-collection-form');
const questionCollectionNameInput = document.getElementById('question-collection-name');

const THEME_STORAGE_KEY = 'qui-de-nous-theme';

const state = {
  roomId: null,
  adminToken: null,
  isAdmin: false,
  heads: [],
  questions: [],
  headCollections: [],
  questionCollections: [],
  currentHeads: [],
  currentQuestion: null,
  roundNumber: 0,
  hasVoted: false,
  selectedPrimary: null,
  selectedSecondary: null,
  roundActive: false,
  roundHasResults: false,
  suspenseActive: false,
  suspenseInterval: null,
  suspenseTimeouts: [],
  players: []
};

function applyTheme(theme) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  document.body.classList.toggle('dark-mode', nextTheme === 'dark');
  if (themeToggle) {
    const label = nextTheme === 'dark' ? 'Mode clair' : 'Mode sombre';
    themeToggle.textContent = label;
    themeToggle.setAttribute('aria-pressed', nextTheme === 'dark' ? 'true' : 'false');
  }
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY);
  } catch (error) {
    saved = null;
  }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = saved === 'dark' || saved === 'light' ? saved : prefersDark ? 'dark' : 'light';
  applyTheme(initial);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, initial);
  } catch (error) {
    // ignore storage errors
  }
}

initTheme();

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2600);
}

function getHeadById(id) {
  if (!id) return null;
  return (
    state.currentHeads.find((head) => head.id === id) ||
    state.heads.find((head) => head.id === id) ||
    null
  );
}

function setVotePanelActive(active) {
  votePanel.classList.toggle('hidden', !active);
  if (!active) {
    submitVoteButton.disabled = true;
  } else {
    updateSubmitButtonState();
  }
}

function updateSubmitButtonState() {
  const ready =
    state.roundActive &&
    !state.hasVoted &&
    Boolean(state.selectedPrimary) &&
    Boolean(state.selectedSecondary);
  submitVoteButton.disabled = !ready;
}

function updateVotePanel() {
  const primaryHead = getHeadById(state.selectedPrimary);
  if (primaryHead) {
    primaryImage.src = primaryHead.imageUrl;
    primaryImage.classList.add('visible');
    primaryPlaceholder.classList.add('hidden');
    primaryName.textContent = primaryHead.name;
  } else {
    primaryImage.src = '';
    primaryImage.classList.remove('visible');
    primaryPlaceholder.classList.remove('hidden');
    primaryName.textContent = state.roundActive
      ? 'Sélectionne ta tête préférée'
      : 'En attente du prochain vote';
  }

  const secondaryHead = getHeadById(state.selectedSecondary);
  if (secondaryHead) {
    secondaryImage.src = secondaryHead.imageUrl;
    secondaryImage.classList.add('visible');
    secondaryPlaceholder.classList.add('hidden');
    secondaryName.textContent = secondaryHead.name;
  } else {
    secondaryImage.src = '';
    secondaryImage.classList.remove('visible');
    secondaryPlaceholder.classList.remove('hidden');
    secondaryName.textContent = state.roundActive
      ? 'Ajoute une deuxième option'
      : 'En attente du prochain vote';
  }

  updateSubmitButtonState();
}

function updateHeadSelectionStyles() {
  Array.from(stageHeads.children).forEach((card) => {
    const headId = card.dataset.headId;
    const badge = card.querySelector('.choice-badge');
    const label = badge ? badge.querySelector('span') : null;
    if (state.selectedPrimary === headId) {
      card.classList.add('primary-selected');
      card.classList.remove('secondary-selected');
      if (badge && label) {
        badge.classList.add('visible');
        label.textContent = '#1';
      }
    } else if (state.selectedSecondary === headId) {
      card.classList.add('secondary-selected');
      card.classList.remove('primary-selected');
      if (badge && label) {
        badge.classList.add('visible');
        label.textContent = '#2';
      }
    } else {
      card.classList.remove('primary-selected');
      card.classList.remove('secondary-selected');
      if (badge && label) {
        badge.classList.remove('visible');
        label.textContent = '';
      }
    }

    if (state.hasVoted || !state.roundActive) {
      card.classList.add('locked');
    } else {
      card.classList.remove('locked');
    }
  });
  updateVotePanel();
}

function selectHead(headId) {
  if (!state.roundActive || state.hasVoted) return;
  if (!headId) return;

  if (state.selectedPrimary === headId) {
    if (state.selectedSecondary) {
      state.selectedPrimary = state.selectedSecondary;
      state.selectedSecondary = null;
    } else {
      state.selectedPrimary = null;
    }
    updateHeadSelectionStyles();
    return;
  }

  if (state.selectedSecondary === headId) {
    state.selectedSecondary = null;
    updateHeadSelectionStyles();
    return;
  }

  if (!state.selectedPrimary) {
    state.selectedPrimary = headId;
  } else if (!state.selectedSecondary) {
    state.selectedSecondary = headId;
  } else {
    state.selectedSecondary = headId;
  }

  updateHeadSelectionStyles();
}

function submitVote() {
  if (!state.roomId || !state.roundActive || state.hasVoted) return;
  if (!state.selectedPrimary || !state.selectedSecondary) {
    showToast('Choisis deux têtes différentes.');
    return;
  }

  socket.emit('castVote', {
    roomId: state.roomId,
    primaryId: state.selectedPrimary,
    secondaryId: state.selectedSecondary
  });

  state.hasVoted = true;
  statusMessage.textContent = 'Vote envoyé ! Suspense...';
  updateHeadSelectionStyles();
}

function toggleSetupDialog(open) {
  if (!state.isAdmin) return;
  setupDialog.classList.toggle('hidden', !open);
}

function updateAdminUI() {
  if (state.isAdmin) {
    openSetupButton.classList.remove('hidden');
    adminControls.classList.remove('hidden');
  } else {
    openSetupButton.classList.add('hidden');
    adminControls.classList.add('hidden');
  }
  updateNextRoundButton();
}

function setShareLink() {
  if (!state.roomId) return;
  const url = `${window.location.origin}?room=${state.roomId}`;
  shareLink.textContent = url;
}

copyLinkButton.addEventListener('click', () => {
  const link = shareLink.textContent;
  if (!link) return;
  navigator.clipboard
    .writeText(link)
    .then(() => showToast('Lien copié !'))
    .catch(() => showToast('Impossible de copier le lien.'));
});

openSetupButton.addEventListener('click', () => toggleSetupDialog(true));
closeSetupButton.addEventListener('click', () => toggleSetupDialog(false));
setupDialog.addEventListener('click', (event) => {
  if (!state.isAdmin) return;
  if (event.target === setupDialog || event.target.classList.contains('modal-backdrop')) {
    toggleSetupDialog(false);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.isAdmin) {
    toggleSetupDialog(false);
  }
});

function renderPlayers(players = []) {
  state.players = players;
  playerList.innerHTML = '';
  players.forEach((player) => {
    const li = document.createElement('li');
    li.textContent = player.name;
    if (player.isAdmin) {
      const badge = document.createElement('span');
      badge.className = 'badge admin';
      badge.textContent = 'admin';
      li.appendChild(badge);
    }
    playerList.appendChild(li);
  });
}

function renderHeadsSetup() {
  headsList.innerHTML = '';
  state.heads.forEach((head) => {
    const chip = document.createElement('div');
    chip.className = 'chip';

    const avatar = document.createElement('span');
    avatar.style.width = '22px';
    avatar.style.height = '22px';
    avatar.style.borderRadius = '50%';
    avatar.style.overflow = 'hidden';
    avatar.style.display = 'inline-flex';
    avatar.style.alignItems = 'center';
    avatar.style.justifyContent = 'center';
    const img = document.createElement('img');
    img.src = head.imageUrl;
    img.alt = head.name;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    avatar.appendChild(img);

    const name = document.createElement('span');
    name.textContent = head.name;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.addEventListener('click', () => removeHead(head.id));

    chip.appendChild(avatar);
    chip.appendChild(name);
    chip.appendChild(remove);
    headsList.appendChild(chip);
  });
}

function renderQuestionsSetup() {
  questionList.innerHTML = '';
  state.questions.forEach((question) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = question.text;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.addEventListener('click', () => removeQuestion(question.id));

    chip.appendChild(remove);
    questionList.appendChild(chip);
  });
}

function renderHeadCollections() {
  if (!headCollectionsList) return;
  headCollectionsList.innerHTML = '';
  if (!state.headCollections.length) {
    headCollectionsList.classList.add('empty');
    headCollectionsList.innerHTML = '<p class="empty-text">Aucune collection pour le moment.</p>';
    return;
  }

  headCollectionsList.classList.remove('empty');
  state.headCollections.forEach((collection) => {
    const item = document.createElement('div');
    item.className = 'collection-item';

    const title = document.createElement('span');
    title.className = 'collection-name';
    title.textContent = collection.name;

    const actions = document.createElement('div');
    actions.className = 'collection-actions';

    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.className = 'ghost';
    applyButton.textContent = 'Charger';
    applyButton.addEventListener('click', () => applyHeadCollection(collection.id));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'ghost danger';
    deleteButton.textContent = 'Supprimer';
    deleteButton.addEventListener('click', () => deleteHeadCollection(collection.id));

    actions.appendChild(applyButton);
    actions.appendChild(deleteButton);
    item.appendChild(title);
    item.appendChild(actions);
    headCollectionsList.appendChild(item);
  });
}

function renderQuestionCollections() {
  if (!questionCollectionsList) return;
  questionCollectionsList.innerHTML = '';
  if (!state.questionCollections.length) {
    questionCollectionsList.classList.add('empty');
    questionCollectionsList.innerHTML = '<p class="empty-text">Aucune collection pour le moment.</p>';
    return;
  }

  questionCollectionsList.classList.remove('empty');
  state.questionCollections.forEach((collection) => {
    const item = document.createElement('div');
    item.className = 'collection-item';

    const title = document.createElement('span');
    title.className = 'collection-name';
    title.textContent = collection.name;

    const actions = document.createElement('div');
    actions.className = 'collection-actions';

    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.className = 'ghost';
    applyButton.textContent = 'Charger';
    applyButton.addEventListener('click', () => applyQuestionCollection(collection.id));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'ghost danger';
    deleteButton.textContent = 'Supprimer';
    deleteButton.addEventListener('click', () => deleteQuestionCollection(collection.id));

    actions.appendChild(applyButton);
    actions.appendChild(deleteButton);
    item.appendChild(title);
    item.appendChild(actions);
    questionCollectionsList.appendChild(item);
  });
}

function applyHeadCollection(collectionId) {
  if (!state.isAdmin || !collectionId) return;
  socket.emit('applyHeadCollection', {
    roomId: state.roomId,
    adminToken: state.adminToken,
    collectionId
  });
  showToast('Collection de têtes chargée !');
}

function deleteHeadCollection(collectionId) {
  if (!state.isAdmin || !collectionId) return;
  if (!window.confirm('Supprimer cette collection de têtes ?')) return;
  socket.emit('deleteHeadCollection', {
    roomId: state.roomId,
    adminToken: state.adminToken,
    collectionId
  });
  showToast('Collection de têtes supprimée.');
}

function applyQuestionCollection(collectionId) {
  if (!state.isAdmin || !collectionId) return;
  socket.emit('applyQuestionCollection', {
    roomId: state.roomId,
    adminToken: state.adminToken,
    collectionId
  });
  showToast('Collection de questions chargée !');
}

function deleteQuestionCollection(collectionId) {
  if (!state.isAdmin || !collectionId) return;
  if (!window.confirm('Supprimer cette collection de questions ?')) return;
  socket.emit('deleteQuestionCollection', {
    roomId: state.roomId,
    adminToken: state.adminToken,
    collectionId
  });
  showToast('Collection de questions supprimée.');
}

function renderStageHeads(heads = [], interactive = false) {
  stageHeads.innerHTML = '';
  heads.forEach((head) => {
    const node = headTemplate.content.firstElementChild.cloneNode(true);
    const image = node.querySelector('.head-image');
    const name = node.querySelector('.head-name');
    image.src = head.imageUrl;
    image.alt = head.name;
    name.textContent = head.name;
    node.dataset.headId = head.id;
    const badge = document.createElement('div');
    badge.className = 'choice-badge';
    const badgeLabel = document.createElement('span');
    badge.appendChild(badgeLabel);
    node.appendChild(badge);

    if (interactive) {
      node.addEventListener('click', () => selectHead(head.id));
      node.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectHead(head.id);
        }
      });
    }
    stageHeads.appendChild(node);
  });
  updateHeadSelectionStyles();
  if (!heads.length) {
    statusMessage.textContent = "En attente que l'admin lance la manche...";
  }
}

function removeHead(headId) {
  socket.emit('removeHead', {
    roomId: state.roomId,
    adminToken: state.adminToken,
    headId
  });
}

function removeQuestion(questionId) {
  socket.emit('removeQuestion', {
    roomId: state.roomId,
    adminToken: state.adminToken,
    questionId
  });
}

function triggerConfetti() {
  confettiContainer.innerHTML = '';
  const colors = ['#a574ff', '#ff9bff', '#ffd166', '#76e5ff', '#ffb6b9'];
  for (let i = 0; i < 180; i += 1) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 1.5}s`;
    piece.style.animationDuration = `${2.6 + Math.random() * 1.8}s`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    confettiContainer.appendChild(piece);
  }
}

function updateTickerDisplay(head) {
  if (!head) return;
  tickerImage.src = head.imageUrl;
  tickerImage.alt = head.name;
  tickerName.textContent = head.name;

  tickerImage.classList.remove('pulse');
  tickerName.classList.remove('pulse');
  void tickerImage.offsetWidth; // force reflow for animation restart
  void tickerName.offsetWidth;
  tickerImage.classList.add('pulse');
  tickerName.classList.add('pulse');
}

function clearSuspense() {
  if (state.suspenseInterval) {
    clearInterval(state.suspenseInterval);
    state.suspenseInterval = null;
  }
  state.suspenseTimeouts.forEach((timeout) => clearTimeout(timeout));
  state.suspenseTimeouts = [];
  state.suspenseActive = false;
  tickerImage.src = '';
  tickerName.textContent = '';
  tickerImage.classList.remove('pulse');
  tickerName.classList.remove('pulse');
  suspenseOverlay.classList.add('hidden');
}

function startSuspense(heads) {
  if (!heads.length) return;
  clearSuspense();
  state.suspenseActive = true;
  suspenseOverlay.classList.remove('hidden');
  let index = 1;
  updateTickerDisplay(heads[0]);
  state.suspenseInterval = setInterval(() => {
    const current = heads[index % heads.length];
    updateTickerDisplay(current);
    index += 1;
  }, 110);
}

function finishSuspense(results) {
  const heads = state.currentHeads;
  const winner = results[0];
  state.roundHasResults = true;
  state.roundActive = false;
  updateNextRoundButton();
  setVotePanelActive(false);

  if (!winner) {
    clearSuspense();
    renderPodium(results);
    statusMessage.textContent = 'Résultats révélés !';
    return;
  }

  if (!heads.length) {
    clearSuspense();
    renderPodium(results);
    triggerConfetti();
    statusMessage.textContent = 'Résultats révélés !';
    return;
  }

  if (!state.suspenseActive) {
    renderPodium(results);
    triggerConfetti();
    statusMessage.textContent = 'Résultats révélés !';
    return;
  }

  if (state.suspenseInterval) {
    clearInterval(state.suspenseInterval);
    state.suspenseInterval = null;
  }

  let index = 0;
  let delay = 220;
  const easingStep = 120;
  const maxDelay = 820;

  const spin = () => {
    const head = heads[index % heads.length];
    updateTickerDisplay(head);
    index += 1;

    if (delay < maxDelay) {
      delay += easingStep;
      const timeout = setTimeout(spin, delay);
      state.suspenseTimeouts.push(timeout);
    } else {
      const finale = setTimeout(() => {
        updateTickerDisplay(winner);
        const revealTimeout = setTimeout(() => {
          clearSuspense();
          renderPodium(results);
          triggerConfetti();
          statusMessage.textContent = 'Résultats révélés !';
        }, 1200);
        state.suspenseTimeouts.push(revealTimeout);
      }, maxDelay + 540);
      state.suspenseTimeouts.push(finale);
    }
  };

  spin();
}

function renderPodium(results) {
  if (!results || results.length === 0) {
    podium.classList.add('hidden');
    podium.classList.remove('visible');
    resultsList.innerHTML = '';
    return;
  }

  podium.classList.remove('hidden');
  podium.classList.remove('visible');

  const formatScore = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '0';
    const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(1);
    return formatted.replace('.', ',');
  };

  const columns = podium.querySelectorAll('.podium-column');
  const mapping = {
    first: results[0] || null,
    second: results[1] || null,
    third: results[2] || null
  };

  columns.forEach((column) => {
    const role = column.classList.contains('first')
      ? 'first'
      : column.classList.contains('second')
      ? 'second'
      : 'third';
    const data = mapping[role];
    column.classList.toggle('empty', !data);
    const avatar = column.querySelector('.podium-avatar');
    const name = column.querySelector('.podium-name');
    const votes = column.querySelector('.podium-votes');
    avatar.innerHTML = '';
    if (data) {
      const img = document.createElement('img');
      img.src = data.imageUrl;
      img.alt = data.name;
      avatar.appendChild(img);
      name.textContent = data.name;
      const scoreLabel = formatScore(data.count);
      const primary = data.primaryVotes || 0;
      const secondary = data.secondaryVotes || 0;
      votes.textContent = `${scoreLabel} pt${scoreLabel === '1' ? '' : 's'}`;
      votes.title = `Votes principaux : ${primary} • Votes bonus : ${secondary}`;
    } else {
      name.textContent = '';
      votes.textContent = '';
      votes.title = '';
    }
  });

  resultsList.innerHTML = '';
  results.forEach((result, index) => {
    const row = document.createElement('div');
    row.className = 'results-row';
    const label = document.createElement('span');
    label.textContent = `#${index + 1} ${result.name}`;
    const value = document.createElement('span');
    const scoreLabel = formatScore(result.count);
    const primary = result.primaryVotes || 0;
    const secondary = result.secondaryVotes || 0;
    value.textContent = `${scoreLabel} pt${scoreLabel === '1' ? '' : 's'} — 🎯 ${primary} ×1 • 💫 ${secondary} ×0,5`;
    row.appendChild(label);
    row.appendChild(value);
    resultsList.appendChild(row);
    setTimeout(() => row.classList.add('visible'), index * 90);
  });

  requestAnimationFrame(() => podium.classList.add('visible'));
}

function updateNextRoundButton() {
  if (!state.isAdmin) return;
  if (state.roundActive) {
    nextRoundButton.disabled = true;
    nextRoundButton.textContent = 'Manche en cours...';
  } else if (state.roundHasResults) {
    nextRoundButton.disabled = false;
    nextRoundButton.textContent = 'Manche suivante';
  } else if (state.roundNumber > 0) {
    nextRoundButton.disabled = false;
    nextRoundButton.textContent = 'Lancer une nouvelle manche';
  } else {
    nextRoundButton.disabled = false;
    nextRoundButton.textContent = 'Lancer la première manche';
  }
}

function switchToGameView() {
  landing.classList.add('hidden');
  gameShell.classList.remove('hidden');
  roomIdLabel.textContent = state.roomId;
  setShareLink();
  updateAdminUI();
}

function joinSocket(name) {
  socket.emit('joinRoom', {
    roomId: state.roomId,
    name,
    adminToken: state.adminToken
  });
}

function createRoom(event) {
  event.preventDefault();
  const adminName = document.getElementById('admin-name').value.trim();
  const password = document.getElementById('admin-password').value.trim();

  fetch('/api/create-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminName, password })
  })
    .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) {
        showToast(data.error || 'Impossible de créer le salon.');
        return;
      }
      state.roomId = data.roomId;
      state.adminToken = data.adminToken;
      state.isAdmin = true;
      joinSocket(adminName);
      switchToGameView();
      toggleSetupDialog(true);
    })
    .catch(() => showToast('Erreur réseau, réessaie.'));
}

function joinRoom(event) {
  event.preventDefault();
  const roomId = document.getElementById('join-room-id').value.trim().toUpperCase();
  const name = document.getElementById('player-name').value.trim();

  fetch('/api/join-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, name })
  })
    .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) {
        showToast(data.error || 'Impossible de rejoindre le salon.');
        return;
      }
      state.roomId = roomId;
      state.isAdmin = false;
      joinSocket(name);
      switchToGameView();
    })
    .catch(() => showToast('Erreur réseau, réessaie.'));
}

function handleJoined(payload) {
  if (!state.roomId) {
    state.roomId = payload.roomId;
    roomIdLabel.textContent = state.roomId;
    setShareLink();
  }
  if (payload.isAdmin) {
    state.isAdmin = true;
  }
  state.heads = payload.heads || [];
  state.questions = payload.questions || [];
  state.roundNumber = payload.roundNumber || 0;
  state.currentQuestion = payload.currentRound ? payload.currentRound.question : null;
  state.roundActive = payload.currentRound ? payload.currentRound.status === 'voting' : false;
  state.roundHasResults = payload.currentRound ? Boolean(payload.currentRound.votes) : false;
  state.hasVoted = false;
  state.selectedPrimary = null;
  state.selectedSecondary = null;

  if (payload.headCollections) {
    state.headCollections = payload.headCollections;
    renderHeadCollections();
  }
  if (payload.questionCollections) {
    state.questionCollections = payload.questionCollections;
    renderQuestionCollections();
  }

  renderHeadsSetup();
  renderQuestionsSetup();
  renderPlayers(payload.players || []);
  updateAdminUI();

  if (payload.currentRound && payload.currentRound.headIds) {
    state.currentHeads = (payload.currentRound.headIds || [])
      .map((id) => state.heads.find((head) => head.id === id))
      .filter(Boolean);
    questionText.textContent = payload.currentRound.question;
    roundBadge.textContent = `Manche ${Math.max(state.roundNumber, 1)}`;
    renderStageHeads(state.currentHeads, state.roundActive);
    if (state.roundActive) {
      setVotePanelActive(true);
      statusMessage.textContent = 'Vote en cours : choisis ton duo gagnant !';
    } else if (payload.currentRound.status === 'reveal') {
      setVotePanelActive(false);
      statusMessage.textContent = 'Suspense en cours...';
    } else if (payload.currentRound.votes) {
      setVotePanelActive(false);
      const results = Object.entries(payload.currentRound.votes)
        .map(([id, tally]) => {
          const head = state.heads.find((item) => item.id === id);
          const score = tally && typeof tally.score === 'number' ? tally.score : 0;
          return head
            ? {
                id,
                count: Number.isInteger(score) ? score : parseFloat(score.toFixed(1)),
                primaryVotes: tally ? tally.primary || 0 : 0,
                secondaryVotes: tally ? tally.secondary || 0 : 0,
                name: head.name,
                imageUrl: head.imageUrl
              }
            : {
                id,
                count: Number.isInteger(score) ? score : parseFloat(score.toFixed(1)),
                primaryVotes: tally ? tally.primary || 0 : 0,
                secondaryVotes: tally ? tally.secondary || 0 : 0,
                name: 'Inconnu',
                imageUrl: ''
              };
        })
        .sort((a, b) => b.count - a.count);
      renderPodium(results);
      statusMessage.textContent = 'Derniers résultats affichés.';
    }
  } else {
    state.currentHeads = [];
    renderStageHeads();
    setVotePanelActive(false);
    podium.classList.add('hidden');
    podium.classList.remove('visible');
  }

  updateVotePanel();
}

function handleRoundStarted({ question, heads, roundNumber }) {
  clearSuspense();
  podium.classList.remove('visible');
  podium.classList.add('hidden');
  resultsList.innerHTML = '';
  state.roundNumber = roundNumber || state.roundNumber + 1;
  state.currentQuestion = question;
  state.currentHeads = heads;
  state.roundActive = true;
  state.roundHasResults = false;
  state.hasVoted = false;
  state.selectedPrimary = null;
  state.selectedSecondary = null;
  questionText.textContent = question;
  roundBadge.textContent = `Manche ${state.roundNumber}`;
  renderStageHeads(heads, true);
  setVotePanelActive(true);
  statusMessage.textContent = 'Choisis ton duo gagnant (#1 & #2) !';
  updateNextRoundButton();
}

function handleVoteProgress({ current, total }) {
  statusMessage.textContent = `Votes reçus : ${current}/${total}`;
}

function handleAllVotesIn() {
  state.roundActive = false;
  updateHeadSelectionStyles();
  statusMessage.textContent = 'Tout le monde a voté ! Prépare-toi...';
  startSuspense(state.currentHeads);
}

function handleRoundResults({ results, roundNumber }) {
  if (roundNumber) {
    state.roundNumber = roundNumber;
    roundBadge.textContent = `Manche ${state.roundNumber}`;
  }
  finishSuspense(results);
}

function handleRoundEnded() {
  clearSuspense();
  state.roundActive = false;
  state.roundHasResults = false;
  state.hasVoted = false;
  state.selectedPrimary = null;
  state.selectedSecondary = null;
  state.currentHeads = [];
  renderStageHeads();
  setVotePanelActive(false);
  podium.classList.add('hidden');
  podium.classList.remove('visible');
  statusMessage.textContent = 'En attente de la prochaine manche...';
  updateNextRoundButton();
  updateVotePanel();
}

createForm.addEventListener('submit', createRoom);
joinForm.addEventListener('submit', joinRoom);

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-mode');
    const nextTheme = isDark ? 'light' : 'dark';
    applyTheme(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (error) {
      // ignore storage errors
    }
  });
}

headForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state.isAdmin) return;
  socket.emit('addHead', {
    roomId: state.roomId,
    adminToken: state.adminToken,
    name: headNameInput.value.trim(),
    imageUrl: headImageInput.value.trim()
  });
  headNameInput.value = '';
  headImageInput.value = '';
});

questionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state.isAdmin) return;
  socket.emit('addQuestion', {
    roomId: state.roomId,
    adminToken: state.adminToken,
    text: questionInput.value.trim()
  });
  questionInput.value = '';
});

if (headCollectionForm) {
  headCollectionForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!state.isAdmin) return;
    const name = headCollectionNameInput.value.trim();
    if (!name) return;
    socket.emit('saveHeadCollection', {
      roomId: state.roomId,
      adminToken: state.adminToken,
      name
    });
    headCollectionNameInput.value = '';
    showToast('Collection de têtes sauvegardée !');
  });
}

if (questionCollectionForm) {
  questionCollectionForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!state.isAdmin) return;
    const name = questionCollectionNameInput.value.trim();
    if (!name) return;
    socket.emit('saveQuestionCollection', {
      roomId: state.roomId,
      adminToken: state.adminToken,
      name
    });
    questionCollectionNameInput.value = '';
    showToast('Collection de questions sauvegardée !');
  });
}

submitVoteButton.addEventListener('click', submitVote);

nextRoundButton.addEventListener('click', () => {
  if (!state.isAdmin) return;
  socket.emit('startRound', {
    roomId: state.roomId,
    adminToken: state.adminToken
  });
});

socket.on('joined', handleJoined);
socket.on('joinError', (message) => showToast(message));
socket.on('playersUpdated', renderPlayers);
socket.on('headsUpdated', (heads) => {
  state.heads = heads;
  renderHeadsSetup();
});
socket.on('questionsUpdated', (questions) => {
  state.questions = questions;
  renderQuestionsSetup();
});
socket.on('headCollectionsUpdated', (collections) => {
  state.headCollections = collections || [];
  renderHeadCollections();
});
socket.on('questionCollectionsUpdated', (collections) => {
  state.questionCollections = collections || [];
  renderQuestionCollections();
});
socket.on('roundStarted', handleRoundStarted);
socket.on('voteProgress', handleVoteProgress);
socket.on('allVotesIn', handleAllVotesIn);
socket.on('roundResults', handleRoundResults);
socket.on('roundEnded', handleRoundEnded);
socket.on('roundError', (message) => showToast(message));

const urlParams = new URLSearchParams(window.location.search);
const presetRoom = urlParams.get('room');
if (presetRoom) {
  document.getElementById('join-room-id').value = presetRoom.toUpperCase();
}
