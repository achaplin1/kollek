const socket = io();

const landing = document.getElementById('landing');
const hub = document.getElementById('hub');
const waitingSelection = document.getElementById('waiting-selection');
const gameShell = document.getElementById('game-shell');
const hubCards = document.querySelectorAll('.hub-card');
const heroChip = document.getElementById('hero-chip');
const heroTitle = document.getElementById('hero-title');
const heroSubtitle = document.getElementById('hero-subtitle');
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
const roundBadge = document.getElementById('round-badge');
const roundHint = document.getElementById('round-hint');
const statusMessage = document.getElementById('status-message');
const adminControls = document.getElementById('admin-controls');
const adminQuiControls = document.getElementById('admin-qui-controls');
const adminWaveControls = document.getElementById('admin-wave-controls');
const waveStartRoundButton = document.getElementById('wave-start-round');
const waveResetRoundButton = document.getElementById('wave-reset-round');
const nextRoundButton = document.getElementById('next-round');
const skipQuestionButton = document.getElementById('skip-question');
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
const headJsonInput = document.getElementById('head-json');
const applyHeadJsonButton = document.getElementById('apply-head-json');
const saveHeadJsonButton = document.getElementById('save-head-json');
const questionJsonInput = document.getElementById('question-json');
const applyQuestionJsonButton = document.getElementById('apply-question-json');
const saveQuestionJsonButton = document.getElementById('save-question-json');
const waveJsonInput = document.getElementById('wave-json');
const applyWaveJsonButton = document.getElementById('apply-wave-json');
const saveWaveJsonButton = document.getElementById('save-wave-json');
const waveScoreboard = document.getElementById('wave-scoreboard');
const gameQui = document.getElementById('game-qui');
const gameWave = document.getElementById('game-wave');
const waveLeftExtreme = document.getElementById('wave-left-extreme');
const waveRightExtreme = document.getElementById('wave-right-extreme');
const waveClueInput = document.getElementById('wave-clue-input');
const waveSubmitClueButton = document.getElementById('wave-submit-clue');
const waveHintEditor = document.getElementById('wave-hint-editor');
const waveHintDisplay = document.getElementById('wave-hint-display');
const waveHintText = document.getElementById('wave-hint-text');
const waveDial = document.getElementById('wave-dial');
const waveDialValue = document.getElementById('wave-dial-value');
const waveSubmitGuessButton = document.getElementById('wave-submit-guess');
const waveClearGuessButton = document.getElementById('wave-clear-guess');
const waveStatus = document.getElementById('wave-status');
const waveTargetArc = document.getElementById('wave-target-arc');
const waveGuessArc = document.getElementById('wave-guess-arc');
const waveAvatars = document.getElementById('wave-avatars');
const waveAvatarTemplate = document.getElementById('wave-avatar-template');
const waveTargetLabel = document.getElementById('wave-target-label');
const waveTargetRange = document.getElementById('wave-target-range');

const SOUND_VOLUMES = {
  round: 0.26,
  join: 0.22,
  select: 0.18,
  submit: 0.24,
  suspense: 0.16,
  reveal: 0.3,
  skip: 0.22
};

const soundLibrary = {};
let soundsLoaded = false;

function loadSounds() {
  fetch('/sounds.json')
    .then((response) => {
      if (!response.ok) {
        throw new Error('Failed to load sounds');
      }
      return response.json();
    })
    .then((sounds) => {
      Object.entries(sounds).forEach(([name, base64]) => {
        const audio = new Audio(`data:audio/wav;base64,${base64}`);
        audio.preload = 'auto';
        audio.volume = SOUND_VOLUMES[name] ?? 0.24;
        soundLibrary[name] = audio;
      });
      soundsLoaded = true;
    })
    .catch(() => {
      soundsLoaded = false;
    });
}

function playSound(name, options = {}) {
  if (!soundsLoaded) return;
  const source = soundLibrary[name];
  if (!source) return;
  const clone = source.cloneNode();
  const baseVolume =
    typeof source.volume === 'number' ? source.volume : SOUND_VOLUMES[name] ?? 0.24;
  clone.volume = typeof options.volume === 'number' ? options.volume : baseVolume;
  clone.currentTime = 0;
  const playPromise = clone.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {});
  }
}

loadSounds();

const state = {
  roomId: null,
  adminToken: null,
  isAdmin: false,
  selfId: null,
  view: 'landing',
  currentGame: null,
  hubReady: false,
  heads: [],
  questions: [],
  presetsLoaded: false,
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
  players: [],
  votesReceived: 0,
  pendingSkip: false,
  wave: {
    roundId: null,
    roundNumber: 0,
    clueGiverId: null,
    card: null,
    hint: '',
    status: 'idle',
    guessValue: null,
    guessLocked: false,
    target: null,
    guesses: [],
    scoreboard: [],
    waiting: null
  }
};

const heroDefaults = {
  chip: heroChip ? heroChip.textContent : '',
  title: heroTitle ? heroTitle.textContent : '',
  subtitle: heroSubtitle ? heroSubtitle.textContent : ''
};

function setHeroToDefault() {
  if (heroChip) {
    heroChip.textContent = heroDefaults.chip;
  }
  if (heroTitle) {
    heroTitle.textContent = heroDefaults.title;
  }
  if (heroSubtitle) {
    heroSubtitle.textContent = heroDefaults.subtitle;
  }
}

function setHeroForRound(question) {
  if (heroChip) {
    heroChip.textContent = 'Qui de Nous ?';
  }
  if (heroTitle) {
    heroTitle.textContent = question;
  }
  if (heroSubtitle) {
    heroSubtitle.textContent = 'Choisis ton duo gagnant (#1 & #2) !';
  }
}

function setHeroForGameIntro(gameType) {
  if (gameType === 'wavelength') {
    setHeroForWave('Prêt à lancer une manche ?', 'Lance la roue : le médium sera choisi automatiquement.');
  } else if (gameType === 'qui') {
    if (heroChip) {
      heroChip.textContent = 'Qui de Nous ?';
    }
    if (heroTitle) {
      heroTitle.textContent = 'Prépare la prochaine manche';
    }
    if (heroSubtitle) {
      heroSubtitle.textContent = 'Ajoute des têtes et des questions puis lance la manche.';
    }
  } else {
    setHeroToDefault();
  }
}

function setHeroForWave(title, subtitle = '') {
  if (heroChip) {
    heroChip.textContent = 'Wavelength maison';
  }
  if (heroTitle) {
    heroTitle.textContent = title;
  }
  if (heroSubtitle) {
    heroSubtitle.textContent = subtitle;
  }
}

function setHeroSubtitle(text) {
  if (heroSubtitle) {
    heroSubtitle.textContent = text;
  }
}

function setRoundHint(text) {
  if (roundHint) {
    roundHint.textContent = text;
  }
}

setHeroToDefault();
renderWaveScoreboard();

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

function applyWaveScores(scores = []) {
  state.wave.scoreboard = Array.isArray(scores) ? scores : [];
  renderWaveScoreboard();
}

function loadPresets(force = false) {
  if (!state.isAdmin || !headJsonInput || !questionJsonInput) {
    return Promise.resolve();
  }
  if (state.presetsLoaded && !force) {
    return Promise.resolve();
  }
  return fetch('/api/presets')
    .then((response) => {
      if (!response.ok) {
        throw new Error('Failed to load presets');
      }
      return response.json();
    })
    .then((data) => {
      const heads = Array.isArray(data.heads) ? data.heads : [];
      const questions = Array.isArray(data.questions) ? data.questions : [];
      const waveCards = Array.isArray(data.waveCards) ? data.waveCards : [];
      if (headJsonInput) {
        headJsonInput.value = JSON.stringify(heads, null, 2);
      }
      if (questionJsonInput) {
        questionJsonInput.value = JSON.stringify(questions, null, 2);
      }
      if (waveJsonInput) {
        waveJsonInput.value = JSON.stringify(waveCards, null, 2);
      }
      state.presetsLoaded = true;
    })
    .catch(() => {
      showToast('Impossible de charger les bibliothèques JSON.');
    });
}

function parseHeadsJson({ allowEmpty = false } = {}) {
  if (!headJsonInput) return [];
  const raw = headJsonInput.value.trim();
  if (!raw) {
    if (allowEmpty) return [];
    showToast('Le JSON des têtes est vide.');
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    showToast('JSON des têtes invalide.');
    return null;
  }
  if (!Array.isArray(parsed)) {
    showToast('Le JSON des têtes doit être une liste d\'objets.');
    return null;
  }
  const sanitized = parsed
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      const imageUrl = typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '';
      if (!name || !imageUrl) return null;
      return { name, imageUrl };
    })
    .filter(Boolean);
  if (!sanitized.length && !allowEmpty) {
    showToast('Ajoute au moins une tête valide (nom + imageUrl).');
    return null;
  }
  return sanitized;
}

function parseQuestionsJson({ allowEmpty = false } = {}) {
  if (!questionJsonInput) return [];
  const raw = questionJsonInput.value.trim();
  if (!raw) {
    if (allowEmpty) return [];
    showToast('Le JSON des questions est vide.');
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    showToast('JSON des questions invalide.');
    return null;
  }
  if (!Array.isArray(parsed)) {
    showToast('Le JSON des questions doit être une liste.');
    return null;
  }
  const sanitized = parsed
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim();
      }
      if (item && typeof item === 'object' && typeof item.text === 'string') {
        return item.text.trim();
      }
      return '';
    })
    .filter((text) => text.length > 0);
  if (!sanitized.length && !allowEmpty) {
    showToast('Ajoute au moins une question dans ton JSON.');
    return null;
  }
  return sanitized;
}

function parseWaveJson({ allowEmpty = false } = {}) {
  if (!waveJsonInput) return [];
  const raw = waveJsonInput.value.trim();
  if (!raw) {
    if (allowEmpty) return [];
    showToast('Le JSON Wavelength est vide.');
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    showToast('JSON Wavelength invalide.');
    return null;
  }
  if (!Array.isArray(parsed)) {
    showToast('Le JSON Wavelength doit être une liste.');
    return null;
  }
  const sanitized = parsed
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const left = typeof item.left === 'string' ? item.left.trim() : '';
      const right = typeof item.right === 'string' ? item.right.trim() : '';
      if (!left || !right) return null;
      return { left, right };
    })
    .filter(Boolean);
  if (!sanitized.length && !allowEmpty) {
    showToast('Ajoute au moins une carte avec "left" et "right".');
    return null;
  }
  return sanitized;
}

function gatherPresetData({ allowEmpty = false } = {}) {
  const heads = parseHeadsJson({ allowEmpty });
  if (heads === null) return null;
  const questions = parseQuestionsJson({ allowEmpty });
  if (questions === null) return null;
  const waveCards = parseWaveJson({ allowEmpty });
  if (waveCards === null) return null;
  return { heads, questions, waveCards };
}

function getHeadById(id) {
  if (!id) return null;
  return (
    state.currentHeads.find((head) => head.id === id) ||
    state.heads.find((head) => head.id === id) ||
    null
  );
}

function getPlayerName(id) {
  if (!id) return '???';
  const player = state.players.find((p) => p.id === id);
  return player ? player.name : '???';
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

function resetWaveState() {
  state.wave.roundId = null;
  state.wave.roundNumber = 0;
  state.wave.clueGiverId = null;
  state.wave.card = null;
  state.wave.hint = '';
  state.wave.status = 'idle';
  state.wave.guessValue = 50;
  state.wave.guessLocked = false;
  state.wave.target = null;
  state.wave.guesses = [];
  state.wave.waiting = null;
}

function clampWaveValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function waveValueToAngle(value) {
  const clamped = clampWaveValue(value);
  return (clamped / 100) * 180 - 90;
}

function updateWavePointerDisplay(value) {
  const clamped = clampWaveValue(value);
  if (waveDial) {
    waveDial.style.setProperty('--pointer-angle', `${waveValueToAngle(clamped)}deg`);
    waveDial.setAttribute('aria-valuenow', `${clamped}`);
  }
  if (waveDialValue) {
    waveDialValue.textContent = `${clamped}`;
  }
  return clamped;
}

function setWaveDialInteractive(active) {
  if (!waveDial) return;
  waveDial.classList.toggle('is-disabled', !active);
  waveDial.setAttribute('aria-disabled', active ? 'false' : 'true');
}

function applyWaveArc(element, startValue, endValue, startProp, endProp) {
  if (!element) return null;
  const startNumeric = Number(startValue);
  const endNumeric = Number(endValue);
  if (!Number.isFinite(startNumeric) || !Number.isFinite(endNumeric)) {
    element.classList.remove('is-visible');
    return null;
  }
  const start = clampWaveValue(startNumeric);
  const end = clampWaveValue(endNumeric);
  const min = Math.min(start, end);
  const max = Math.max(start, end);
  const startDeg = `${(min / 100) * 180}deg`;
  const endDeg = `${(max / 100) * 180}deg`;
  element.style.setProperty(startProp, startDeg);
  element.style.setProperty(endProp, endDeg);
  const startAngle = waveValueToAngle(min);
  const endAngle = waveValueToAngle(max);
  element.style.setProperty(`${startProp}-angle`, `${startAngle}deg`);
  element.style.setProperty(`${endProp}-angle`, `${endAngle}deg`);
  const center = (min + max) / 2;
  const centerAngle = waveValueToAngle(center);
  element.style.setProperty('--wave-arc-center-angle', `${centerAngle}deg`);
  element.style.setProperty('--wave-arc-center-value', `${Math.round(center)}`);
  element.classList.remove('hidden');
  element.classList.add('is-visible');
  return { min, max, center };
}

function computeDialValueFromEvent(event) {
  if (!waveDial) return null;
  const rect = waveDial.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = centerY - event.clientY;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  let angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (!Number.isFinite(angle)) {
    return null;
  }
  if (angle < 0) angle = 0;
  if (angle > 180) angle = 180;
  const value = Math.round(((180 - angle) / 180) * 100);
  return clampWaveValue(value);
}

function renderWaveAvatars(guesses = [], revealed = false) {
  if (!waveAvatars) return;
  waveAvatars.innerHTML = '';
  if (!Array.isArray(guesses) || !guesses.length) {
    return;
  }
  const template = waveAvatarTemplate ? waveAvatarTemplate.content.firstElementChild : null;
  guesses
    .slice()
    .sort((a, b) => a.value - b.value)
    .forEach((entry, index) => {
      const base = template ? template.cloneNode(true) : document.createElement('div');
      const node = base.classList ? base : Object.assign(document.createElement('div'), { className: 'wave-avatar' });
      const chip = node.querySelector('.wave-avatar-chip') || Object.assign(document.createElement('span'), { className: 'wave-avatar-chip' });
      const label = node.querySelector('.wave-avatar-name') || Object.assign(document.createElement('span'), { className: 'wave-avatar-name' });
      if (!chip.parentElement) node.appendChild(chip);
      if (!label.parentElement) node.appendChild(label);
      const name = getPlayerName(entry.playerId);
      chip.textContent = name ? name.charAt(0).toUpperCase() : '?';
      label.textContent = revealed ? name : '';
      const angle = waveValueToAngle(entry.value);
      node.style.setProperty('--wave-angle', `${angle}deg`);
      node.style.setProperty('--wave-arrival-delay', `${index * 80}ms`);
      node.classList.add('is-visible');
      node.classList.toggle('is-me', entry.playerId === state.selfId);
      node.classList.toggle('revealed', revealed);
      if (typeof entry.points === 'number' && revealed) {
        node.dataset.points = `${entry.points}`;
      } else {
        delete node.dataset.points;
      }
      waveAvatars.appendChild(node);
    });
}

function renderWaveState() {
  if (state.currentGame !== 'wavelength') {
    renderWaveScoreboard();
    return;
  }

  const wave = state.wave;
  const isClueGiver = wave.clueGiverId && wave.clueGiverId === state.selfId;
  const left = wave.card ? wave.card.left : '—';
  const right = wave.card ? wave.card.right : '—';
  if (waveLeftExtreme) waveLeftExtreme.textContent = left;
  if (waveRightExtreme) waveRightExtreme.textContent = right;

  switch (wave.status) {
    case 'waitingClue':
      setHeroForWave(
        isClueGiver ? 'Écris ton indice' : `${getPlayerName(wave.clueGiverId)} prépare un indice...`,
        `${left} ↔ ${right}`
      );
      break;
    case 'guessing':
      setHeroForWave(wave.hint ? `Indice : ${wave.hint}` : 'Indice en attente...', `${left} ↔ ${right}`);
      break;
    case 'locked':
      setHeroForWave(`Indice : ${wave.hint || '...'}`, 'Révélation en approche ✨');
      break;
    case 'revealed':
      setHeroForWave(`Indice : ${wave.hint || '...'}`, 'Zone révélée !');
      break;
    default:
      setHeroForWave('Prêt à lancer une manche ?', 'Le jeu choisira le médium automatiquement.');
      break;
  }

  if (roundBadge) {
    roundBadge.textContent = `Manche ${wave.roundNumber || 1}`;
  }

  if (waveHintEditor) {
    waveHintEditor.classList.toggle('hidden', !(isClueGiver && wave.status === 'waitingClue'));
  }
  if (waveHintDisplay) {
    const hideDisplay = isClueGiver && wave.status === 'waitingClue';
    waveHintDisplay.classList.toggle('hidden', hideDisplay);
    if (waveHintText) {
      waveHintText.textContent = wave.hint
        ? wave.hint
        : isClueGiver
        ? 'Écris ton indice puis envoie-le.'
        : wave.status === 'waitingClue'
        ? `${getPlayerName(wave.clueGiverId)} prépare un indice...`
        : 'Indice en attente...';
    }
  }

  const canGuess = wave.status === 'guessing' && !isClueGiver;
  if (!Number.isFinite(wave.guessValue)) {
    wave.guessValue = 50;
  }
  const pointerValue = updateWavePointerDisplay(wave.guessValue);
  wave.guessValue = pointerValue;
  setWaveDialInteractive(canGuess && !wave.guessLocked);
  if (waveSubmitGuessButton) {
    waveSubmitGuessButton.disabled = !canGuess || wave.guessLocked;
  }
  if (waveClearGuessButton) {
    waveClearGuessButton.disabled = !canGuess;
  }
  if (waveSubmitClueButton) {
    waveSubmitClueButton.disabled = !(isClueGiver && wave.status === 'waitingClue');
  }

  if (waveStartRoundButton) {
    const readyToStart = state.isAdmin && (wave.status === 'idle' || wave.status === 'revealed');
    waveStartRoundButton.disabled = !readyToStart;
  }

  if (waveResetRoundButton) {
    const canReset = state.isAdmin && Boolean(wave.roundId);
    waveResetRoundButton.disabled = !canReset;
  }

  if (waveTargetArc) {
    if (wave.target && (wave.status === 'revealed' || isClueGiver)) {
      const arcInfo = applyWaveArc(
        waveTargetArc,
        wave.target.start,
        wave.target.end,
        '--wave-target-start',
        '--wave-target-end'
      );
      const showPrivate = Boolean(isClueGiver && wave.status !== 'revealed');
      waveTargetArc.classList.toggle('is-private', showPrivate);
      if (waveTargetLabel) {
        const shouldShowLabel = Boolean(showPrivate && arcInfo);
        waveTargetLabel.classList.toggle('is-visible', shouldShowLabel);
        if (shouldShowLabel && waveTargetRange) {
          const startText = arcInfo.min.toString().padStart(2, '0');
          const endText = arcInfo.max.toString().padStart(2, '0');
          waveTargetRange.textContent = `${startText} – ${endText}`;
        } else if (waveTargetRange) {
          waveTargetRange.textContent = '—';
        }
      }
    } else {
      waveTargetArc.classList.remove('is-visible', 'is-private');
      waveTargetArc.classList.add('hidden');
      if (waveTargetLabel) {
        waveTargetLabel.classList.remove('is-visible');
      }
      if (waveTargetRange) {
        waveTargetRange.textContent = '—';
      }
    }
  }

  if (waveGuessArc) {
    if ((wave.status === 'locked' || wave.status === 'revealed') && wave.guesses.length) {
      const values = wave.guesses.map((entry) => entry.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      applyWaveArc(waveGuessArc, min, max, '--wave-guess-start', '--wave-guess-end');
    } else {
      waveGuessArc.classList.remove('is-visible');
      waveGuessArc.classList.add('hidden');
    }
  }

  if (wave.status === 'locked' || wave.status === 'revealed') {
    renderWaveAvatars(wave.guesses, wave.status === 'revealed');
  } else {
    renderWaveAvatars([], false);
  }

  let hintText = '';
  if (wave.status === 'waitingClue') {
    hintText = isClueGiver ? 'Écris ton indice et partage-le.' : `${getPlayerName(wave.clueGiverId)} prépare un indice...`;
  } else if (wave.status === 'guessing') {
    hintText = wave.waiting
      ? `Positions reçues : ${wave.waiting.received}/${wave.waiting.total}`
      : 'Place ton curseur et valide ta position.';
  } else if (wave.status === 'locked') {
    hintText = 'Révélation en approche...';
  } else if (wave.status === 'revealed') {
    hintText = 'Zone révélée !';
  } else {
    hintText = 'Appuie sur “Lancer la manche” pour tirer un médium aléatoire.';
  }
  setRoundHint(hintText);

  if (wave.status === 'guessing' && wave.waiting) {
    waveStatus.textContent = `Positions reçues : ${wave.waiting.received}/${wave.waiting.total}`;
  } else {
    let statusText = '';
    if (wave.status === 'waitingClue') {
      statusText = isClueGiver
        ? 'Prépare un indice qui place tout le monde au bon endroit.'
        : `${getPlayerName(wave.clueGiverId)} prépare un indice.`;
    } else if (wave.status === 'guessing') {
      statusText = isClueGiver
        ? 'Les autres placent leurs curseurs.'
        : wave.guessLocked
        ? 'Position enregistrée ! Attends les autres...'
        : 'Glisse ton curseur et valide ta position.';
    } else if (wave.status === 'locked') {
      statusText = 'Révélation en approche...';
    } else if (wave.status === 'revealed') {
      statusText = 'Zone révélée ! Nouvelle manche quand l\'admin le souhaite.';
    } else {
      statusText = 'Lance la manche pour choisir un médium automatiquement.';
    }
    if (waveStatus) {
      waveStatus.textContent = statusText;
    }
  }

  renderWaveScoreboard();
}

function hydrateWaveState(waveState) {
  resetWaveState();
  if (!waveState) {
    renderWaveState();
    return;
  }
  state.wave.roundId = waveState.id || null;
  state.wave.roundNumber = waveState.roundNumber || 0;
  state.wave.clueGiverId = waveState.clueGiverId || null;
  state.wave.card = waveState.card || null;
  state.wave.hint = waveState.hint || '';
  state.wave.status = waveState.status || 'waitingClue';
  state.wave.target = waveState.target || null;
  state.wave.guesses = Array.isArray(waveState.guesses)
    ? waveState.guesses.map((entry) => ({ ...entry }))
    : [];
  const selfGuess = state.wave.guesses.find((entry) => entry.playerId === state.selfId);
  state.wave.guessValue = selfGuess ? selfGuess.value : 50;
  state.wave.guessLocked = Boolean(selfGuess);
  state.wave.waiting = null;
  renderWaveState();
}

function setActiveGame(gameType, { waveState = null, silent = false } = {}) {
  state.currentGame = gameType;
  if (!gameType) {
    if (gameQui) gameQui.classList.add('hidden');
    if (gameWave) gameWave.classList.add('hidden');
    if (adminQuiControls) adminQuiControls.classList.add('hidden');
    if (adminWaveControls) adminWaveControls.classList.add('hidden');
    setVotePanelActive(false);
    renderWaveScoreboard();
    return;
  }

  if (gameQui) {
    gameQui.classList.toggle('hidden', gameType !== 'qui');
  }
  if (gameWave) {
    gameWave.classList.toggle('hidden', gameType !== 'wavelength');
  }
  if (adminQuiControls) {
    adminQuiControls.classList.toggle('hidden', gameType !== 'qui');
  }
  if (adminWaveControls) {
    adminWaveControls.classList.toggle('hidden', gameType !== 'wavelength');
  }
  if (votePanel) {
    votePanel.classList.toggle('hidden', gameType !== 'qui');
  }

  if (gameType === 'qui') {
    resetWaveState();
    setHeroForGameIntro('qui');
    renderWaveScoreboard();
  } else if (gameType === 'wavelength') {
    state.pendingSkip = false;
    state.roundActive = false;
    state.roundHasResults = false;
    if (!silent || waveState) {
      hydrateWaveState(waveState);
    } else {
      renderWaveState();
    }
  }
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
  let didSelect = false;

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
    didSelect = true;
  } else if (!state.selectedSecondary) {
    state.selectedSecondary = headId;
    didSelect = true;
  } else {
    state.selectedSecondary = headId;
    didSelect = true;
  }

  updateHeadSelectionStyles();
  if (didSelect) {
    playSound('select');
  }
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

  playSound('submit');
  state.hasVoted = true;
  statusMessage.textContent = 'Vote envoyé ! Suspense...';
  updateHeadSelectionStyles();
}

function toggleSetupDialog(open) {
  if (!state.isAdmin) return;
  if (open && !state.presetsLoaded) {
    loadPresets();
  }
  setupDialog.classList.toggle('hidden', !open);
}

function applyHeadPreset() {
  if (!state.isAdmin) return;
  const heads = parseHeadsJson();
  if (!heads || !state.roomId) return;
  if (headJsonInput) {
    headJsonInput.value = JSON.stringify(heads, null, 2);
  }
  socket.emit('replaceHeads', {
    roomId: state.roomId,
    adminToken: state.adminToken,
    heads
  });
  showToast('Têtes chargées depuis le JSON !');
}

function applyQuestionPreset() {
  if (!state.isAdmin) return;
  const questions = parseQuestionsJson();
  if (!questions || !state.roomId) return;
  if (questionJsonInput) {
    questionJsonInput.value = JSON.stringify(questions, null, 2);
  }
  socket.emit('replaceQuestions', {
    roomId: state.roomId,
    adminToken: state.adminToken,
    questions
  });
  showToast('Questions chargées depuis le JSON !');
}

function applyWavePreset() {
  if (!state.isAdmin) return;
  const waveCards = parseWaveJson();
  if (!waveCards || !state.roomId) return;
  if (waveJsonInput) {
    waveJsonInput.value = JSON.stringify(waveCards, null, 2);
  }
  socket.emit('replaceWaveCards', {
    roomId: state.roomId,
    adminToken: state.adminToken,
    cards: waveCards
  });
  showToast('Cartes Wavelength chargées depuis le JSON !');
}

function savePresetJson() {
  if (!state.isAdmin || !state.adminToken) return;
  const payload = gatherPresetData({ allowEmpty: true });
  if (!payload) return;
  fetch('/api/presets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': state.adminToken
    },
    body: JSON.stringify(payload)
  })
    .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) {
        showToast(data.error || 'Impossible de sauvegarder le JSON.');
        return;
      }
      const heads = Array.isArray(data.heads) ? data.heads : payload.heads;
      const questions = Array.isArray(data.questions) ? data.questions : payload.questions;
      const waveCards = Array.isArray(data.waveCards) ? data.waveCards : payload.waveCards;
      if (headJsonInput) {
        headJsonInput.value = JSON.stringify(heads, null, 2);
      }
      if (questionJsonInput) {
        questionJsonInput.value = JSON.stringify(questions, null, 2);
      }
      if (waveJsonInput) {
        waveJsonInput.value = JSON.stringify(waveCards, null, 2);
      }
      state.presetsLoaded = true;
      showToast('Bibliothèques JSON enregistrées !');
    })
    .catch(() => {
      showToast('Impossible de sauvegarder le JSON pour le moment.');
    });
}

function updateAdminUI() {
  const showSetup = state.isAdmin && state.view !== 'landing';
  openSetupButton.classList.toggle('hidden', !showSetup);
  const showControls = state.isAdmin && state.view === 'game' && Boolean(state.currentGame);
  adminControls.classList.toggle('hidden', !showControls);
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

window.addEventListener('resize', () => adjustHeadGridColumns(state.currentHeads.length));
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

function renderWaveScoreboard() {
  if (!waveScoreboard) return;
  const isWave = state.currentGame === 'wavelength';
  waveScoreboard.classList.toggle('hidden', !isWave);
  waveScoreboard.innerHTML = '';
  if (!isWave) {
    return;
  }
  const scores = Array.isArray(state.wave.scoreboard) ? [...state.wave.scoreboard] : [];
  if (!scores.length) {
    const hint = document.createElement('p');
    hint.className = 'rail-hint';
    hint.textContent = 'Les points apparaîtront ici.';
    waveScoreboard.appendChild(hint);
    return;
  }
  scores.sort((a, b) => (b.score || 0) - (a.score || 0));
  scores.forEach((entry, index) => {
    const player = state.players.find((p) => p.id === entry.playerId);
    const row = document.createElement('div');
    row.className = 'score-row';
    const place = document.createElement('span');
    place.className = 'score-rank';
    place.textContent = `${index + 1}.`;
    const name = document.createElement('span');
    name.className = 'score-name';
    name.textContent = player ? player.name : '???';
    const value = document.createElement('span');
    value.className = 'score-value';
    let displayScore = '0';
    if (typeof entry.score === 'number' && !Number.isNaN(entry.score)) {
      displayScore = Number.isInteger(entry.score)
        ? String(entry.score)
        : entry.score.toFixed(1);
    }
    value.textContent = displayScore;
    row.appendChild(place);
    row.appendChild(name);
    row.appendChild(value);
    waveScoreboard.appendChild(row);
  });
}

function renderPlayers(players = []) {
  const previousPlayers = Array.isArray(state.players) ? state.players : [];
  const previousIds = new Set(previousPlayers.map((player) => player.id));
  const previousLength = previousPlayers.length;
  state.players = players;
  playerList.innerHTML = '';
  players.forEach((player) => {
    const li = document.createElement('li');
    li.textContent = player.name;
    playerList.appendChild(li);
  });
  renderWaveScoreboard();
  if (
    players.length > previousLength &&
    players.some((player) => !previousIds.has(player.id))
  ) {
    playSound('join');
  }
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

function computeBalancedColumns(count) {
  if (!count || count <= 1) {
    return count === 1 ? 1 : 0;
  }
  const maxColumns = Math.min(Math.max(2, count), 6);
  let chosen = Math.min(4, maxColumns);
  for (let candidate = maxColumns; candidate >= 2; candidate -= 1) {
    if (count % candidate === 0) {
      chosen = candidate;
      break;
    }
  }
  if (count <= 3) {
    chosen = count;
  }
  return Math.max(chosen, 1);
}

function adjustHeadGridColumns(count) {
  if (!stageHeads) return;
  if (!count || window.innerWidth < 940) {
    stageHeads.style.removeProperty('grid-template-columns');
    return;
  }
  const columns = computeBalancedColumns(count);
  stageHeads.style.gridTemplateColumns = `repeat(${columns}, minmax(var(--head-card-min), 1fr))`;
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
  adjustHeadGridColumns(heads.length);
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
  setHeroSubtitle('Suspense en cours...');
  setRoundHint('Suspense... le reveal arrive !');
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
  if (state.currentQuestion) {
    setHeroForRound(state.currentQuestion);
  }

  if (!winner) {
    clearSuspense();
    renderPodium(results);
    playSound('reveal');
    statusMessage.textContent = 'Résultats révélés !';
    setHeroSubtitle('Podium révélé ✨');
    setRoundHint('Podium révélé ✨');
    return;
  }

  if (!heads.length) {
    clearSuspense();
    renderPodium(results);
    playSound('reveal');
    triggerConfetti();
    statusMessage.textContent = 'Résultats révélés !';
    setHeroSubtitle('Podium révélé ✨');
    setRoundHint('Podium révélé ✨');
    return;
  }

  if (!state.suspenseActive) {
    renderPodium(results);
    playSound('reveal');
    triggerConfetti();
    statusMessage.textContent = 'Résultats révélés !';
    setHeroSubtitle('Podium révélé ✨');
    setRoundHint('Podium révélé ✨');
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
          playSound('reveal');
          triggerConfetti();
          statusMessage.textContent = 'Résultats révélés !';
          setHeroSubtitle('Podium révélé ✨');
          setRoundHint('Podium révélé ✨');
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
  if (nextRoundButton) {
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
  if (skipQuestionButton) {
    const showSkip = state.roundActive || state.pendingSkip;
    skipQuestionButton.classList.toggle('hidden', !showSkip);
    const canSkip = state.roundActive && state.votesReceived === 0 && !state.pendingSkip;
    skipQuestionButton.disabled = !canSkip;
    skipQuestionButton.textContent = state.pendingSkip ? 'Passage...' : 'Passer la question';
  }
}

function setView(view) {
  state.view = view;
  if (landing) landing.classList.toggle('hidden', view !== 'landing');
  if (hub) hub.classList.toggle('hidden', view !== 'hub');
  if (waitingSelection) waitingSelection.classList.toggle('hidden', view !== 'waiting');
  if (gameShell) gameShell.classList.toggle('hidden', view !== 'game');
}

function enterHubView() {
  setView('hub');
  setHeroToDefault();
  if (roundHint) {
    roundHint.textContent = 'Choisis un jeu pour commencer.';
  }
  if (roundBadge) {
    roundBadge.textContent = 'Manche 1';
  }
}

function enterWaitingView() {
  setView('waiting');
  setHeroToDefault();
  if (roundHint) {
    roundHint.textContent = 'L\'admin choisit le jeu...';
  }
}

function enterGameView() {
  setView('game');
  if (roomIdLabel) {
    roomIdLabel.textContent = state.roomId || '';
  }
  setShareLink();
  updateAdminUI();
  if (state.currentGame) {
    setHeroForGameIntro(state.currentGame);
  } else {
    setHeroToDefault();
  }
  if (roundHint && !state.currentGame) {
    roundHint.textContent = 'Sélectionne un jeu pour commencer.';
  }
  if (roundBadge) {
    roundBadge.textContent = 'Manche 1';
  }
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
      state.presetsLoaded = false;
      joinSocket(adminName);
      enterHubView();
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
      enterWaitingView();
    })
    .catch(() => showToast('Erreur réseau, réessaie.'));
}

function handleJoined(payload) {
  if (!state.roomId) {
    state.roomId = payload.roomId;
    roomIdLabel.textContent = state.roomId;
    setShareLink();
  }
  if (payload.selfId) {
    state.selfId = payload.selfId;
  }
  if (payload.isAdmin) {
    state.isAdmin = true;
    state.presetsLoaded = false;
  }
  state.heads = payload.heads || [];
  state.questions = payload.questions || [];
  renderHeadsSetup();
  renderQuestionsSetup();
  renderPlayers(payload.players || []);
  applyWaveScores(payload.waveScores || []);

  const selectedGame = payload.gameType || null;
  setActiveGame(selectedGame, {
    waveState: payload.waveState || null,
    silent: true
  });

  if (!selectedGame) {
    if (state.isAdmin) {
      enterHubView();
    } else {
      enterWaitingView();
    }
    return;
  }

  enterGameView();

  if (selectedGame === 'qui') {
    state.roundNumber = payload.roundNumber || 0;
    state.currentQuestion = payload.currentRound ? payload.currentRound.question : null;
    state.roundActive = payload.currentRound ? payload.currentRound.status === 'voting' : false;
    state.roundHasResults = payload.currentRound ? Boolean(payload.currentRound.votes) : false;
    state.hasVoted = false;
    state.selectedPrimary = null;
    state.selectedSecondary = null;
    updateAdminUI();

    if (roundBadge) {
      roundBadge.textContent = state.roundNumber > 0 ? `Manche ${state.roundNumber}` : 'Manche 1';
    }

    if (payload.currentRound && payload.currentRound.headIds) {
      state.currentHeads = (payload.currentRound.headIds || [])
        .map((id) => state.heads.find((head) => head.id === id))
        .filter(Boolean);
      if (state.currentQuestion) {
        setHeroForRound(state.currentQuestion);
      }
      setRoundHint('Vote en cours — #1 + #2 obligatoires !');
      renderStageHeads(state.currentHeads, state.roundActive);
      if (state.roundActive) {
        setVotePanelActive(true);
        statusMessage.textContent = 'Vote en cours : choisis ton duo gagnant !';
        setHeroSubtitle('Vote en cours : choisis ton duo gagnant !');
      } else if (payload.currentRound.status === 'reveal') {
        setVotePanelActive(false);
        statusMessage.textContent = 'Suspense en cours...';
        setHeroSubtitle('Suspense en cours...');
        setRoundHint('Suspense... le reveal arrive !');
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
        if (state.currentQuestion) {
          setHeroForRound(state.currentQuestion);
          setHeroSubtitle('Podium révélé ✨');
        }
        setRoundHint('Podium révélé ✨');
      }
    } else {
      state.currentHeads = [];
      renderStageHeads();
      setVotePanelActive(false);
      podium.classList.add('hidden');
      podium.classList.remove('visible');
      setHeroForGameIntro('qui');
      setRoundHint(
        state.roundNumber > 0
          ? 'En attente de la prochaine manche...'
          : "En attente que l'admin lance la partie..."
      );
    }

    updateVotePanel();
  } else if (selectedGame === 'wavelength') {
    updateAdminUI();
    hydrateWaveState(payload.waveState || null);
  }
}

function handleRoundStarted({ question, heads, roundNumber }) {
  clearSuspense();
  podium.classList.remove('visible');
  podium.classList.add('hidden');
  resultsList.innerHTML = '';
  const previousRoundNumber = state.roundNumber;
  const wasSkipping = state.pendingSkip;
  state.roundNumber = roundNumber || state.roundNumber + 1;
  state.currentQuestion = question;
  state.currentHeads = heads;
  state.roundActive = true;
  state.roundHasResults = false;
  state.hasVoted = false;
  state.selectedPrimary = null;
  state.selectedSecondary = null;
  state.votesReceived = 0;
  state.pendingSkip = false;
  roundBadge.textContent = `Manche ${state.roundNumber}`;
  if (state.currentQuestion) {
    setHeroForRound(state.currentQuestion);
    setHeroSubtitle('Vote en cours : choisis ton duo gagnant !');
  } else {
    setHeroToDefault();
  }
  setRoundHint('Vote en cours — #1 + #2 obligatoires !');
  renderStageHeads(heads, true);
  setVotePanelActive(true);
  statusMessage.textContent = 'Choisis ton duo gagnant (#1 & #2) !';
  updateNextRoundButton();
  if (wasSkipping) {
    playSound('skip');
  } else {
    playSound('round');
  }
}

function handleVoteProgress({ current, total }) {
  statusMessage.textContent = `Votes reçus : ${current}/${total}`;
  setHeroSubtitle(`Votes reçus : ${current}/${total}`);
  state.votesReceived = current;
  updateNextRoundButton();
}

function handleAllVotesIn() {
  state.roundActive = false;
  updateHeadSelectionStyles();
  statusMessage.textContent = 'Tout le monde a voté ! Prépare-toi...';
  setHeroSubtitle('Tout le monde a voté ! Suspense...');
  setRoundHint('Suspense... le reveal arrive !');
  state.votesReceived = state.players.length;
  updateNextRoundButton();
  playSound('suspense');
  startSuspense(state.currentHeads);
}

function handleRoundResults({ results, roundNumber }) {
  if (roundNumber) {
    state.roundNumber = roundNumber;
    roundBadge.textContent = `Manche ${state.roundNumber}`;
  }
  state.votesReceived = state.players.length;
  updateNextRoundButton();
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
  state.votesReceived = 0;
  state.pendingSkip = false;
  renderStageHeads();
  setVotePanelActive(false);
  podium.classList.add('hidden');
  podium.classList.remove('visible');
  statusMessage.textContent = 'En attente de la prochaine manche...';
  setHeroToDefault();
  setRoundHint('En attente de la prochaine manche...');
  updateNextRoundButton();
  updateVotePanel();
}

function handleRoundError(message) {
  if (state.pendingSkip) {
    state.pendingSkip = false;
    updateNextRoundButton();
  }
  showToast(message);
}

function handleGameSelected({ gameType, heads = [], questions = [], waveState = null, waveScores = [] }) {
  state.heads = heads;
  state.questions = questions;
  renderHeadsSetup();
  renderQuestionsSetup();
  applyWaveScores(waveScores);

  setActiveGame(gameType || null, { waveState });
  updateAdminUI();

  if (!gameType) {
    if (state.isAdmin) {
      enterHubView();
    } else {
      enterWaitingView();
    }
    return;
  }

  enterGameView();

  if (gameType === 'qui') {
    state.roundNumber = 0;
    state.roundActive = false;
    state.roundHasResults = false;
    state.currentQuestion = null;
    state.currentHeads = [];
    renderStageHeads();
    setHeroForGameIntro('qui');
    setRoundHint("En attente que l'admin lance la partie...");
    updateVotePanel();
  } else if (gameType === 'wavelength') {
    if (waveState) {
      hydrateWaveState(waveState);
    } else {
      renderWaveState();
    }
    setRoundHint('Appuie sur “Lancer la manche” pour tirer un médium aléatoire.');
  }
}

function handleWaveRoundPending({ clueGiverId, card, roundNumber }) {
  setActiveGame('wavelength', { silent: true });
  enterGameView();
  state.wave.roundId = null;
  state.wave.roundNumber = roundNumber || state.wave.roundNumber + 1;
  state.wave.clueGiverId = clueGiverId;
  state.wave.card = card || null;
  state.wave.hint = '';
  state.wave.status = 'waitingClue';
  state.wave.guessLocked = false;
  state.wave.guessValue = 50;
  state.wave.guesses = [];
  state.wave.target = null;
  state.wave.waiting = null;
  setRoundHint(`${getPlayerName(clueGiverId)} prépare un indice...`);
  renderWaveState();
  playSound('round');
}

function handleWaveClueCard({ roundId, card, target, roundNumber }) {
  if (card) {
    state.wave.card = card;
  }
  state.wave.roundId = roundId;
  state.wave.roundNumber = roundNumber || state.wave.roundNumber;
  state.wave.target = target || null;
  state.wave.status = 'waitingClue';
  renderWaveState();
}

function handleWaveClueShared({ roundId, clueGiverId, card, hint, roundNumber }) {
  state.wave.roundId = roundId;
  state.wave.clueGiverId = clueGiverId;
  if (card) {
    state.wave.card = card;
  }
  state.wave.roundNumber = roundNumber || state.wave.roundNumber;
  state.wave.hint = hint || '';
  state.wave.status = 'guessing';
  state.wave.guessLocked = false;
  if (!Number.isFinite(state.wave.guessValue)) {
    state.wave.guessValue = 50;
  }
  state.wave.guesses = [];
  state.wave.waiting = null;
  setRoundHint('Place ton curseur et valide ta position.');
  renderWaveState();
  playSound('round');
}

function handleWaveGuessAck({ roundId, value }) {
  if (!state.wave.roundId || state.wave.roundId !== roundId) return;
  state.wave.guessLocked = true;
  state.wave.guessValue = Number(value);
  state.wave.waiting = null;
  renderWaveState();
  playSound('submit');
}

function handleWaveWaiting({ roundId, received, total }) {
  if (!state.wave.roundId || state.wave.roundId !== roundId) return;
  state.wave.waiting = { received, total };
  renderWaveState();
}

function handleWaveRevealStart({ roundId, guesses = [], card, hint, roundNumber, clueGiverId }) {
  state.wave.roundId = roundId;
  state.wave.status = 'locked';
  state.wave.card = card || state.wave.card;
  state.wave.hint = hint || state.wave.hint;
  state.wave.roundNumber = roundNumber || state.wave.roundNumber;
  state.wave.clueGiverId = clueGiverId || state.wave.clueGiverId;
  state.wave.guesses = Array.isArray(guesses)
    ? guesses.map((entry) => ({ playerId: entry.playerId, value: entry.value }))
    : [];
  state.wave.waiting = null;
  setRoundHint('Révélation en approche...');
  renderWaveState();
  playSound('suspense');
}

function handleWaveTargetRevealed({
  roundId,
  target,
  results = [],
  clueGiverId,
  card,
  hint,
  roundNumber
}) {
  if (!state.wave.roundId || state.wave.roundId !== roundId) {
    state.wave.roundId = roundId;
  }
  state.wave.status = 'revealed';
  state.wave.target = target || null;
  state.wave.guesses = Array.isArray(results)
    ? results.map((entry) => ({
        playerId: entry.playerId,
        value: entry.value,
        diff: entry.diff,
        points: entry.points
      }))
    : [];
  state.wave.clueGiverId = clueGiverId || state.wave.clueGiverId;
  state.wave.card = card || state.wave.card;
  state.wave.hint = hint || state.wave.hint;
  state.wave.roundNumber = roundNumber || state.wave.roundNumber;
  state.wave.waiting = null;
  setRoundHint('Zone révélée !');
  renderWaveState();
  triggerConfetti();
  playSound('reveal');
}

function handleWaveRoundCleared() {
  const previousNumber = state.wave.roundNumber;
  resetWaveState();
  state.wave.roundNumber = previousNumber;
  renderWaveState();
  setRoundHint('Appuie sur “Lancer la manche” pour tirer un médium aléatoire.');
}

function handleWaveError(message) {
  showToast(message);
  state.wave.waiting = null;
  renderWaveState();
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

if (applyHeadJsonButton) {
  applyHeadJsonButton.addEventListener('click', applyHeadPreset);
}

if (applyQuestionJsonButton) {
  applyQuestionJsonButton.addEventListener('click', applyQuestionPreset);
}

if (applyWaveJsonButton) {
  applyWaveJsonButton.addEventListener('click', applyWavePreset);
}

if (saveHeadJsonButton) {
  saveHeadJsonButton.addEventListener('click', savePresetJson);
}

if (saveQuestionJsonButton) {
  saveQuestionJsonButton.addEventListener('click', savePresetJson);
}

if (saveWaveJsonButton) {
  saveWaveJsonButton.addEventListener('click', savePresetJson);
}

submitVoteButton.addEventListener('click', submitVote);

nextRoundButton.addEventListener('click', () => {
  if (!state.isAdmin) return;
  socket.emit('startRound', {
    roomId: state.roomId,
    adminToken: state.adminToken
  });
});

if (skipQuestionButton) {
  skipQuestionButton.addEventListener('click', () => {
    if (!state.isAdmin || !state.roundActive || state.votesReceived > 0 || state.pendingSkip) {
      return;
    }
    state.pendingSkip = true;
    skipQuestionButton.disabled = true;
    socket.emit('skipQuestion', {
      roomId: state.roomId,
      adminToken: state.adminToken
    });
    updateNextRoundButton();
  });
}

hubCards.forEach((card) => {
  card.addEventListener('click', () => {
    if (!state.isAdmin || !state.roomId) return;
    const gameType = card.dataset.game;
    if (!gameType) return;
    socket.emit('selectGame', {
      roomId: state.roomId,
      adminToken: state.adminToken,
      gameType
    });
  });
});

if (waveStartRoundButton) {
  waveStartRoundButton.addEventListener('click', () => {
    if (!state.isAdmin || state.currentGame !== 'wavelength') return;
    socket.emit('startWaveRound', {
      roomId: state.roomId,
      adminToken: state.adminToken
    });
  });
}

if (waveResetRoundButton) {
  waveResetRoundButton.addEventListener('click', () => {
    if (!state.isAdmin || state.currentGame !== 'wavelength') return;
    socket.emit('resetWaveRound', {
      roomId: state.roomId,
      adminToken: state.adminToken
    });
  });
}

if (waveSubmitClueButton) {
  waveSubmitClueButton.addEventListener('click', () => {
    if (state.wave.status !== 'waitingClue' || state.wave.clueGiverId !== state.selfId) return;
    const clue = waveClueInput ? waveClueInput.value.trim() : '';
    if (!clue) {
      showToast('Écris un indice avant de l\'envoyer.');
      return;
    }
    socket.emit('submitWaveClue', {
      roomId: state.roomId,
      roundId: state.wave.roundId,
      clue
    });
    if (waveClueInput) {
      waveClueInput.value = '';
    }
  });
}

function waveDialIsInteractive() {
  return (
    state.currentGame === 'wavelength' &&
    state.wave.status === 'guessing' &&
    state.wave.clueGiverId !== state.selfId &&
    !state.wave.guessLocked
  );
}

if (waveDial) {
  let dialPointerId = null;
  let dialDragging = false;

  const endDialDrag = () => {
    if (!dialDragging) return;
    dialDragging = false;
    if (
      dialPointerId !== null &&
      typeof waveDial.releasePointerCapture === 'function' &&
      typeof waveDial.hasPointerCapture === 'function' &&
      waveDial.hasPointerCapture(dialPointerId)
    ) {
      waveDial.releasePointerCapture(dialPointerId);
    }
    dialPointerId = null;
  };

  const updateFromPointer = (event) => {
    if (!waveDialIsInteractive()) return;
    const value = computeDialValueFromEvent(event);
    if (value === null) return;
    state.wave.guessValue = value;
    updateWavePointerDisplay(value);
  };

  waveDial.addEventListener('pointerdown', (event) => {
    if (!waveDialIsInteractive()) return;
    event.preventDefault();
    dialDragging = true;
    dialPointerId = event.pointerId;
    if (typeof waveDial.setPointerCapture === 'function') {
      try {
        waveDial.setPointerCapture(dialPointerId);
      } catch (error) {
        // ignore capture errors
      }
    }
    updateFromPointer(event);
  });

  waveDial.addEventListener('pointermove', (event) => {
    if (!dialDragging) return;
    event.preventDefault();
    updateFromPointer(event);
  });

  waveDial.addEventListener('pointerup', () => {
    endDialDrag();
  });

  waveDial.addEventListener('pointercancel', () => {
    endDialDrag();
  });

  waveDial.addEventListener('lostpointercapture', () => {
    endDialDrag();
  });

  waveDial.addEventListener('keydown', (event) => {
    if (!waveDialIsInteractive()) return;
    const step = event.shiftKey ? 5 : 2;
    let nextValue = state.wave.guessValue;
    let handled = true;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        nextValue = clampWaveValue(nextValue - step);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        nextValue = clampWaveValue(nextValue + step);
        break;
      case 'Home':
        nextValue = 0;
        break;
      case 'End':
        nextValue = 100;
        break;
      case 'PageUp':
        nextValue = clampWaveValue(nextValue + 10);
        break;
      case 'PageDown':
        nextValue = clampWaveValue(nextValue - 10);
        break;
      default:
        handled = false;
        break;
    }
    if (!handled) return;
    event.preventDefault();
    state.wave.guessValue = nextValue;
    updateWavePointerDisplay(nextValue);
  });
}

if (waveSubmitGuessButton) {
  waveSubmitGuessButton.addEventListener('click', () => {
    if (state.wave.status !== 'guessing' || state.wave.clueGiverId === state.selfId) return;
    if (state.wave.guessLocked) return;
    if (!state.wave.roundId) return;
    socket.emit('waveGuess', {
      roomId: state.roomId,
      roundId: state.wave.roundId,
      value: state.wave.guessValue
    });
  });
}

if (waveClearGuessButton) {
  waveClearGuessButton.addEventListener('click', () => {
    if (state.wave.status !== 'guessing' || state.wave.clueGiverId === state.selfId) return;
    if (state.wave.guessLocked) return;
    state.wave.guessValue = 50;
    updateWavePointerDisplay(50);
    renderWaveState();
  });
}

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
socket.on('roundError', handleRoundError);
socket.on('gameSelected', handleGameSelected);
socket.on('waveRoundPending', handleWaveRoundPending);
socket.on('waveClueCard', handleWaveClueCard);
socket.on('waveClueShared', handleWaveClueShared);
socket.on('waveGuessAck', handleWaveGuessAck);
socket.on('waveWaiting', handleWaveWaiting);
socket.on('waveRevealStart', handleWaveRevealStart);
socket.on('waveTargetRevealed', handleWaveTargetRevealed);
socket.on('waveRoundCleared', handleWaveRoundCleared);
socket.on('waveScoresUpdated', (scores) => applyWaveScores(scores));
socket.on('waveError', handleWaveError);
socket.on('waveCardsUpdated', () => {
  if (state.isAdmin) {
    showToast('Cartes Wavelength mises à jour !');
  }
});

const urlParams = new URLSearchParams(window.location.search);
const presetRoom = urlParams.get('room');
if (presetRoom) {
  document.getElementById('join-room-id').value = presetRoom.toUpperCase();
}
