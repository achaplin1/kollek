const socket = io();

const createForm = document.getElementById('create-room-form');
const joinForm = document.getElementById('join-room-form');
const adminArea = document.getElementById('admin-area');
const playerArea = document.getElementById('player-area');
const authPanels = document.getElementById('auth-panels');
const roomIdSpan = document.getElementById('room-id');
const shareLink = document.getElementById('share-link');
const copyLinkButton = document.getElementById('copy-link');
const playerList = document.getElementById('player-list');
const headForm = document.getElementById('head-form');
const headNameInput = document.getElementById('head-name');
const headImageInput = document.getElementById('head-image');
const headsContainer = document.getElementById('heads');
const headSelection = document.getElementById('head-selection');
const roundForm = document.getElementById('round-form');
const roundQuestionInput = document.getElementById('round-question');
const endRoundButton = document.getElementById('end-round');
const playerQuestion = document.getElementById('player-question');
const playerHeads = document.getElementById('player-heads');
const voteStatus = document.getElementById('vote-status');
const resultsContainer = document.getElementById('results');
const confettiContainer = document.getElementById('confetti');

let state = {
  roomId: null,
  adminToken: null,
  isAdmin: false,
  heads: [],
  selectedHeadIds: new Set()
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
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

function renderPlayers(players) {
  playerList.innerHTML = '';
  players.forEach((player) => {
    const li = document.createElement('li');
    li.textContent = player.name;
    if (player.isAdmin) {
      const badge = document.createElement('span');
      badge.textContent = 'admin';
      badge.className = 'badge admin';
      li.appendChild(badge);
    }
    playerList.appendChild(li);
  });
}

function renderHeads() {
  const availableIds = new Set(state.heads.map((head) => head.id));
  state.selectedHeadIds = new Set(
    Array.from(state.selectedHeadIds).filter((id) => availableIds.has(id))
  );

  headsContainer.innerHTML = '';
  headSelection.innerHTML = '';

  state.heads.forEach((head) => {
    const card = createHeadCard(head);
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Supprimer';
    removeBtn.className = 'ghost';
    removeBtn.addEventListener('click', () => removeHead(head.id));
    const wrapper = document.createElement('div');
    wrapper.className = 'stack';
    wrapper.appendChild(card);
    wrapper.appendChild(removeBtn);
    headsContainer.appendChild(wrapper);

    const selectableCard = createHeadCard(head);
    selectableCard.tabIndex = 0;
    if (state.selectedHeadIds.has(head.id)) {
      selectableCard.classList.add('selected');
    }
    selectableCard.addEventListener('click', () => toggleHeadSelection(head.id));
    selectableCard.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleHeadSelection(head.id);
      }
    });
    headSelection.appendChild(selectableCard);
  });
}

function createHeadCard(head) {
  const template = document.getElementById('head-card-template');
  const node = template.content.firstElementChild.cloneNode(true);
  const image = node.querySelector('.head-image');
  const name = node.querySelector('.head-name');
  image.src = head.imageUrl;
  image.alt = head.name;
  name.textContent = head.name;
  return node;
}

function toggleHeadSelection(headId) {
  if (state.selectedHeadIds.has(headId)) {
    state.selectedHeadIds.delete(headId);
  } else {
    state.selectedHeadIds.add(headId);
  }
  renderHeads();
}

function removeHead(headId) {
  socket.emit('removeHead', {
    roomId: state.roomId,
    adminToken: state.adminToken,
    headId
  });
}

function triggerConfetti() {
  confettiContainer.innerHTML = '';
  const colors = ['#ffd166', '#ef476f', '#06d6a0', '#8ecae6', '#ff6f91'];
  for (let i = 0; i < 120; i += 1) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    piece.style.transform = `translateY(-100vh) rotateZ(${Math.random() * 360}deg)`;
    confettiContainer.appendChild(piece);
  }
}

function renderResults(results) {
  if (!results || results.length === 0) {
    resultsContainer.classList.add('hidden');
    return;
  }

  resultsContainer.innerHTML = '';
  const title = document.createElement('h2');
  title.textContent = 'Podium des votes';
  resultsContainer.appendChild(title);

  const podium = document.createElement('div');
  podium.className = 'podium';

  const decorated = results.map((result, index) => ({
    ...result,
    position: index + 1
  }));

  decorated.slice(0, 3).forEach((item) => {
    const podiumItem = document.createElement('div');
    podiumItem.className = 'podium-item';
    if (item.position === 1) podiumItem.classList.add('gold');
    if (item.position === 2) podiumItem.classList.add('silver');
    if (item.position === 3) podiumItem.classList.add('bronze');

    const img = document.createElement('img');
    img.src = item.imageUrl;
    img.alt = item.name;

    const name = document.createElement('div');
    name.textContent = item.name;
    name.className = 'head-name';

    const votes = document.createElement('div');
    votes.textContent = `${item.count} vote${item.count > 1 ? 's' : ''}`;
    votes.className = 'vote-progress';

    podiumItem.appendChild(img);
    podiumItem.appendChild(name);
    podiumItem.appendChild(votes);
    podium.appendChild(podiumItem);
  });

  resultsContainer.appendChild(podium);

  const list = document.createElement('div');
  list.className = 'list';
  decorated.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'list';
    row.style.flexDirection = 'row';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.background = 'rgba(255, 255, 255, 0.08)';
    row.style.padding = '0.5rem 0.75rem';
    row.style.borderRadius = '12px';

    const left = document.createElement('div');
    left.textContent = `#${item.position} ${item.name}`;
    const right = document.createElement('div');
    right.textContent = `${item.count} vote${item.count > 1 ? 's' : ''}`;

    row.appendChild(left);
    row.appendChild(right);
    list.appendChild(row);
  });

  resultsContainer.appendChild(list);
  resultsContainer.classList.remove('hidden');
  triggerConfetti();
}

function showVotingOptions(heads) {
  playerHeads.innerHTML = '';
  resultsContainer.classList.add('hidden');

  heads.forEach((head) => {
    const card = createHeadCard(head);
    card.addEventListener('click', () => castVote(head.id));
    card.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        castVote(head.id);
      }
    });
    playerHeads.appendChild(card);
  });
}

async function createRoom(event) {
  event.preventDefault();
  const adminName = document.getElementById('admin-name').value.trim();
  const password = document.getElementById('admin-password').value.trim();

  const response = await fetch('/api/create-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminName, password })
  });

  const data = await response.json();
  if (!response.ok) {
    showToast(data.error || 'Impossible de créer le salon.');
    return;
  }

  state.roomId = data.roomId;
  state.adminToken = data.adminToken;
  state.isAdmin = true;
  joinSocket(adminName);
  switchToAdminView();
}

async function joinRoom(event) {
  event.preventDefault();
  const roomId = document.getElementById('join-room-id').value.trim().toUpperCase();
  const name = document.getElementById('player-name').value.trim();

  const response = await fetch('/api/join-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, name })
  });

  const data = await response.json();
  if (!response.ok) {
    showToast(data.error || 'Impossible de rejoindre le salon.');
    return;
  }

  state.roomId = roomId;
  state.isAdmin = false;
  joinSocket(name);
  switchToPlayerView();
}

function joinSocket(name) {
  socket.emit('joinRoom', {
    roomId: state.roomId,
    name,
    adminToken: state.adminToken
  });
}

function switchToAdminView() {
  authPanels.classList.add('hidden');
  adminArea.classList.remove('hidden');
  playerArea.classList.remove('hidden');
  roomIdSpan.textContent = state.roomId;
  const link = `${window.location.origin}?room=${state.roomId}`;
  shareLink.textContent = link;
  copyLinkButton.addEventListener('click', () => {
    navigator.clipboard.writeText(link);
    showToast('Lien copié dans le presse-papiers !');
  });
}

function switchToPlayerView() {
  authPanels.classList.add('hidden');
  playerArea.classList.remove('hidden');
}

function castVote(headId) {
  if (!state.roomId) return;
  socket.emit('castVote', { roomId: state.roomId, headId });
  voteStatus.textContent = 'Vote envoyé ! En attente des autres...';
}

function handleJoined(payload) {
  if (!state.roomId) {
    state.roomId = payload.roomId;
  }
  if (payload.isAdmin) {
    state.isAdmin = true;
  }
  state.heads = payload.heads || [];
  renderHeads();
  renderPlayers(payload.players || []);

  if (payload.currentRound && payload.currentRound.status !== 'results') {
    playerQuestion.textContent = payload.currentRound.question;
  }
}

function handleRoundStarted({ question, heads }) {
  state.selectedHeadIds = new Set(heads.map((head) => head.id));
  playerQuestion.textContent = question;
  voteStatus.textContent = 'Choisis la tête correspondante...';
  showVotingOptions(heads);
}

function handleAllVotesIn() {
  voteStatus.textContent = 'Tous les votes sont là... révélation imminente !';
}

function handleVoteProgress({ current, total }) {
  voteStatus.textContent = `Votes reçus: ${current}/${total}`;
}

function handleRoundResults({ results }) {
  voteStatus.textContent = '';
  renderResults(results);
}

function handleRoundEnded() {
  voteStatus.textContent = '';
  resultsContainer.classList.add('hidden');
  playerQuestion.textContent = 'En attente de la prochaine manche...';
  playerHeads.innerHTML = '';
  state.selectedHeadIds.clear();
  renderHeads();
}

function startRound(event) {
  event.preventDefault();
  if (!state.selectedHeadIds.size) {
    showToast('Sélectionne au moins une tête.');
    return;
  }

  socket.emit('startRound', {
    roomId: state.roomId,
    adminToken: state.adminToken,
    question: roundQuestionInput.value.trim(),
    headIds: Array.from(state.selectedHeadIds)
  });
  roundQuestionInput.value = '';
  voteStatus.textContent = 'La manche commence !';
}

createForm.addEventListener('submit', createRoom);
joinForm.addEventListener('submit', joinRoom);
roundForm.addEventListener('submit', startRound);
headForm.addEventListener('submit', (event) => {
  event.preventDefault();
  socket.emit('addHead', {
    roomId: state.roomId,
    adminToken: state.adminToken,
    name: headNameInput.value.trim(),
    imageUrl: headImageInput.value.trim()
  });
  headNameInput.value = '';
  headImageInput.value = '';
});

endRoundButton.addEventListener('click', () => {
  socket.emit('endRound', {
    roomId: state.roomId,
    adminToken: state.adminToken
  });
});

const urlParams = new URLSearchParams(window.location.search);
const presetRoom = urlParams.get('room');
if (presetRoom) {
  document.getElementById('join-room-id').value = presetRoom;
}

socket.on('joined', handleJoined);
socket.on('joinError', (message) => showToast(message));
socket.on('playersUpdated', renderPlayers);
socket.on('headsUpdated', (heads) => {
  state.heads = heads;
  renderHeads();
});
socket.on('roundStarted', handleRoundStarted);
socket.on('voteProgress', handleVoteProgress);
socket.on('allVotesIn', handleAllVotesIn);
socket.on('roundResults', handleRoundResults);
socket.on('roundEnded', handleRoundEnded);
