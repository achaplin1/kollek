const socket = io();

const landing = document.getElementById('landing');
const gameShell = document.getElementById('game-shell');
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
const podium = document.getElementById('podium');
const resultsList = document.getElementById('results-list');
const confettiContainer = document.getElementById('confetti');
const suspenseOverlay = document.getElementById('suspense-overlay');
const fusionOrbit = document.getElementById('fusion-orbit');
const fusionCore = document.querySelector('.fusion-core');
const rouletteImage = document.getElementById('roulette-image');
const rouletteName = document.getElementById('roulette-name');
const headTemplate = document.getElementById('head-card-template');

const state = {
  roomId: null,
  adminToken: null,
  isAdmin: false,
  heads: [],
  questions: [],
  currentHeads: [],
  currentQuestion: null,
  roundNumber: 0,
  hasVoted: false,
  selectedVote: null,
  roundActive: false,
  roundHasResults: false,
  suspenseActive: false,
  suspenseInterval: null,
  suspenseTimeouts: [],
  players: []
};

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
    if (interactive) {
      node.addEventListener('click', () => castVote(head.id));
      node.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          castVote(head.id);
        }
      });
    } else {
      node.classList.add('locked');
    }
    stageHeads.appendChild(node);
  });
  if (!heads.length) {
    statusMessage.textContent = "En attente que l'admin lance la manche...";
  }
}

function highlightVote(headId) {
  Array.from(stageHeads.children).forEach((card) => {
    if (card.dataset.headId === headId) {
      card.classList.add('chosen');
    }
    card.classList.add('locked');
  });
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
  const colors = ['#ff5edb', '#44d1ff', '#ffd166', '#6bffb8', '#bd7aff'];
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

function clearSuspense() {
  if (state.suspenseInterval) {
    clearInterval(state.suspenseInterval);
    state.suspenseInterval = null;
  }
  state.suspenseTimeouts.forEach((timeout) => clearTimeout(timeout));
  state.suspenseTimeouts = [];
  state.suspenseActive = false;
  fusionCore.classList.remove('locked');
  rouletteImage.src = '';
  rouletteName.textContent = '';
  fusionOrbit.innerHTML = '';
  suspenseOverlay.classList.add('hidden');
}

function startSuspense(heads) {
  if (!heads.length) return;
  clearSuspense();
  state.suspenseActive = true;
  suspenseOverlay.classList.remove('hidden');
  fusionOrbit.innerHTML = '';
  fusionCore.classList.remove('locked');
  heads.forEach((head, index) => {
    const orbit = document.createElement('div');
    orbit.className = 'orbit-head';
    orbit.style.setProperty('--angle', `${(index / heads.length) * 360}deg`);
    orbit.style.setProperty('--delay', `${index * 0.14}s`);
    const img = document.createElement('img');
    img.src = head.imageUrl;
    img.alt = head.name;
    orbit.appendChild(img);
    fusionOrbit.appendChild(orbit);
  });
  let index = 0;
  rouletteImage.src = heads[0].imageUrl;
  rouletteName.textContent = heads[0].name;
  state.suspenseInterval = setInterval(() => {
    const current = heads[index % heads.length];
    rouletteImage.src = current.imageUrl;
    rouletteName.textContent = current.name;
    index += 1;
  }, 140);
}

function finishSuspense(results) {
  const heads = state.currentHeads;
  const winner = results[0];
  state.roundHasResults = true;
  state.roundActive = false;
  updateNextRoundButton();

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
  let delay = 160;

  const spin = () => {
    const head = heads[index % heads.length];
    rouletteImage.src = head.imageUrl;
    rouletteName.textContent = head.name;
    index += 1;
    if (delay < 420) {
      delay += 45;
      const timeout = setTimeout(spin, delay);
      state.suspenseTimeouts.push(timeout);
    } else {
      const finale = setTimeout(() => {
        rouletteImage.src = winner.imageUrl;
        rouletteName.textContent = winner.name;
        fusionCore.classList.add('locked');
        const revealTimeout = setTimeout(() => {
          clearSuspense();
          renderPodium(results);
          triggerConfetti();
          statusMessage.textContent = 'Résultats révélés !';
        }, 800);
        state.suspenseTimeouts.push(revealTimeout);
      }, delay);
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
      votes.textContent = `${data.count} vote${data.count > 1 ? 's' : ''}`;
    } else {
      name.textContent = '';
      votes.textContent = '';
    }
  });

  resultsList.innerHTML = '';
  results.forEach((result, index) => {
    const row = document.createElement('div');
    row.className = 'results-row';
    const label = document.createElement('span');
    label.textContent = `#${index + 1} ${result.name}`;
    const value = document.createElement('span');
    value.textContent = `${result.count} vote${result.count > 1 ? 's' : ''}`;
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
  state.selectedVote = null;

  renderHeadsSetup();
  renderQuestionsSetup();
  renderPlayers(payload.players || []);
  updateAdminUI();

  if (payload.currentRound && payload.currentRound.headIds) {
    state.currentHeads = (payload.currentRound.headIds || [])
      .map((id) => state.heads.find((head) => head.id === id))
      .filter(Boolean);
    renderStageHeads(state.currentHeads, state.roundActive);
    questionText.textContent = payload.currentRound.question;
    roundBadge.textContent = `Manche ${Math.max(state.roundNumber, 1)}`;
    if (state.roundActive) {
      statusMessage.textContent = 'Vote en cours...';
    } else if (payload.currentRound.status === 'reveal') {
      statusMessage.textContent = 'Suspense en cours...';
    } else if (payload.currentRound.votes) {
      const results = Object.entries(payload.currentRound.votes)
        .map(([id, count]) => {
          const head = state.heads.find((item) => item.id === id);
          return head
            ? { id, count, name: head.name, imageUrl: head.imageUrl }
            : { id, count, name: 'Inconnu', imageUrl: '' };
        })
        .sort((a, b) => b.count - a.count);
      renderPodium(results);
      statusMessage.textContent = 'Derniers résultats affichés.';
    }
  } else {
    state.currentHeads = [];
    renderStageHeads();
    podium.classList.add('hidden');
    podium.classList.remove('visible');
  }
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
  state.selectedVote = null;
  questionText.textContent = question;
  roundBadge.textContent = `Manche ${state.roundNumber}`;
  renderStageHeads(heads, true);
  statusMessage.textContent = 'Choisis la tête qui colle le mieux !';
  updateNextRoundButton();
}

function castVote(headId) {
  if (!state.roomId || state.hasVoted || !state.roundActive) return;
  socket.emit('castVote', { roomId: state.roomId, headId });
  state.hasVoted = true;
  state.selectedVote = headId;
  statusMessage.textContent = 'Vote envoyé ! Suspense...';
  highlightVote(headId);
}

function handleVoteProgress({ current, total }) {
  statusMessage.textContent = `Votes reçus : ${current}/${total}`;
}

function handleAllVotesIn() {
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
  state.currentHeads = [];
  renderStageHeads();
  podium.classList.add('hidden');
  podium.classList.remove('visible');
  statusMessage.textContent = 'En attente de la prochaine manche...';
  updateNextRoundButton();
}

createForm.addEventListener('submit', createRoom);
joinForm.addEventListener('submit', joinRoom);

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
