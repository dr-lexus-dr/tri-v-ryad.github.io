import { i18n, t } from './i18n.js';
import { Platform } from './platform.js';
import { audio } from './audio.js';
import { Game, COLS, ROWS } from './game.js';
import { Renderer } from './render.js';

const SAVE_KEY = 'gems.save.v1';
const DEFAULT_SAVE = {
  v: 1,
  level: 1,
  total: 0,
  best: 0,
  stars: {},
  sound: true,
  lang: null
};

const OVERLAYS = ['ov-pause', 'ov-win', 'ov-lose', 'ov-leaders'];

const app = {
  game: null,
  renderer: null,
  save: { ...DEFAULT_SAVE },
  screen: 'menu',
  overlay: null,
  start: null,
  idleTimer: 0,
  saveTimer: 0,
  toastTimer: 0,
  scoreTimer: 0,
  busyAd: false,
  adActive: false,
  resetArmedUntil: 0
};

const dom = {};

function initDom() {
  const ids = [
    'screen-menu', 'screen-game', 'btn-play', 'btn-leaders', 'btn-reset', 'btn-lang',
    'btn-sound-menu', 'menu-level', 'menu-total', 'hud-level', 'hud-score', 'hud-moves',
    'moves-badge', 'goals', 'btn-pause', 'board', 'board-stage', 'btn-shuffle',
    'shuffle-count', 'btn-resume', 'btn-restart', 'btn-pause-sound', 'btn-to-menu',
    'win-stars', 'win-score', 'win-bonus', 'win-total', 'btn-next', 'btn-win-menu',
    'btn-continue-ad', 'btn-retry', 'btn-lose-menu', 'lb-list', 'btn-leaders-close',
    'loading', 'toast', 'ov-pause', 'ov-win', 'ov-lose', 'ov-leaders'
  ];
  for (const id of ids) {
    dom[id] = document.getElementById(id);
  }
  dom.chipScore = dom['hud-score'].closest('.chip');
}

/* ---------- Сохранения ---------- */

function normalizeSave(data) {
  const save = { ...DEFAULT_SAVE, ...(data && typeof data === 'object' ? data : {}) };
  save.level = Math.max(1, Math.floor(Number(save.level) || 1));
  save.total = Math.max(0, Math.floor(Number(save.total) || 0));
  save.best = Math.max(0, Math.floor(Number(save.best) || 0));
  save.stars = save.stars && typeof save.stars === 'object' ? save.stars : {};
  save.sound = save.sound !== false;
  save.lang = save.lang === 'ru' || save.lang === 'en' ? save.lang : null;
  return save;
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? normalizeSave(JSON.parse(raw)) : { ...DEFAULT_SAVE };
  } catch (error) {
    return { ...DEFAULT_SAVE };
  }
}

function mergeSaves(local, cloud) {
  const a = normalizeSave(local);
  const b = normalizeSave(cloud);
  const stars = { ...a.stars };
  for (const [level, value] of Object.entries(b.stars)) {
    stars[level] = Math.max(Number(stars[level]) || 0, Number(value) || 0);
  }
  return normalizeSave({
    ...a,
    level: Math.max(a.level, b.level),
    total: Math.max(a.total, b.total),
    best: Math.max(a.best, b.best),
    stars,
    sound: a.sound,
    lang: a.lang || b.lang
  });
}

function flushSave() {
  clearTimeout(app.saveTimer);
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(app.save));
  } catch (error) {
    /* приватный режим — просто играем без локального сохранения */
  }
  Platform.save(app.save);
}

function persist() {
  clearTimeout(app.saveTimer);
  app.saveTimer = setTimeout(flushSave, 500);
}

/* ---------- Звук ---------- */

function applySound() {
  audio.setEnabled(app.save.sound);
  document.body.classList.toggle('is-muted', !app.save.sound);
}

function toggleSound() {
  app.save.sound = !app.save.sound;
  applySound();
  persist();
  audio.click();
}

/* ---------- Экраны и оверлеи ---------- */

function showScreen(name) {
  dom['screen-menu'].classList.toggle('is-hidden', name !== 'menu');
  dom['screen-game'].classList.toggle('is-hidden', name !== 'game');
  app.screen = name;
}

function openOverlay(id) {
  for (const name of OVERLAYS) dom[name].classList.add('is-hidden');
  dom[id].classList.remove('is-hidden');
  app.overlay = id;
}

function closeOverlays() {
  for (const name of OVERLAYS) dom[name].classList.add('is-hidden');
  app.overlay = null;
}

function hideLoading() {
  dom.loading.classList.add('is-done');
  setTimeout(() => dom.loading.classList.add('is-hidden'), 300);
}

function toast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.remove('is-hidden');
  clearTimeout(app.toastTimer);
  app.toastTimer = setTimeout(() => dom.toast.classList.add('is-hidden'), 2600);
}

/* ---------- HUD ---------- */

function renderGoals(goals) {
  dom.goals.textContent = '';
  for (const goal of goals) {
    const done = goal.got >= goal.need;

    const chip = document.createElement('div');
    chip.className = done ? 'goal is-done' : 'goal';

    const gem = document.createElement('span');
    gem.className = 'gem';
    gem.dataset.type = String(goal.type);

    const num = document.createElement('span');
    num.className = 'goal-num';

    const got = document.createElement('b');
    got.textContent = String(Math.min(goal.got, goal.need));

    const need = document.createElement('i');
    need.textContent = `/${goal.need}`;

    num.append(got, need);
    chip.append(gem, num);
    dom.goals.append(chip);
  }
}

function updateMoves(moves) {
  dom['hud-moves'].textContent = String(moves);
  dom['moves-badge'].classList.toggle('is-low', moves <= 3);
}

function updateScore(score) {
  dom['hud-score'].textContent = i18n.formatNumber(score);
  dom.chipScore.classList.add('is-bump');
  clearTimeout(app.scoreTimer);
  app.scoreTimer = setTimeout(() => dom.chipScore.classList.remove('is-bump'), 150);
}

function updateShuffle(count) {
  dom['shuffle-count'].textContent = String(count);
  dom['btn-shuffle'].disabled = count <= 0;
}

function applySnapshot(snap) {
  dom['hud-level'].textContent = String(snap.level);
  updateMoves(snap.movesLeft);
  updateScore(snap.score);
  renderGoals(snap.goals);
  updateShuffle(snap.shuffles);
}

function refreshMenu() {
  dom['menu-level'].textContent = String(app.save.level);
  dom['menu-total'].textContent = i18n.formatNumber(app.save.total);
}

function updateLangButton() {
  dom['btn-lang'].textContent = i18n.lang === 'ru' ? 'English' : 'Русский';
}

/* ---------- Игра ---------- */

function handleGameEvent(type, data) {
  switch (type) {
    case 'level':
      applySnapshot(data);
      break;
    case 'score':
      updateScore(data);
      break;
    case 'goals':
      renderGoals(data);
      break;
    case 'moves':
      updateMoves(data);
      break;
    case 'shuffles':
      updateShuffle(data);
      break;
    case 'shuffle':
      if (data && data.auto) toast(t('noMoves'));
      break;
    case 'win':
      onWin(data);
      break;
    case 'lose':
      onLose(data);
      break;
    default:
      break;
  }
}

function startLevel(level) {
  closeOverlays();
  showScreen('game');
  app.game.startLevel(level);
  app.renderer.resize();
  app.renderer.start();
  Platform.gameplayStart();
  scheduleHint();
}

function onWin(data) {
  app.save.total += data.score;
  app.save.best = Math.max(app.save.best, data.score);
  app.save.stars[data.level] = Math.max(Number(app.save.stars[data.level]) || 0, data.stars);
  app.save.level = Math.max(app.save.level, data.level + 1);
  flushSave();
  Platform.submitScore(app.save.total);
  Platform.gameplayStop();

  dom['win-score'].textContent = i18n.formatNumber(data.score - data.bonus);
  dom['win-bonus'].textContent = `+${i18n.formatNumber(data.bonus)}`;
  dom['win-total'].textContent = i18n.formatNumber(app.save.total);
  dom['win-stars'].querySelectorAll('.star').forEach((star, index) => {
    star.classList.toggle('is-on', index < data.stars);
  });

  app.renderer.stop();
  openOverlay('ov-win');

  for (let i = 0; i < data.stars; i++) {
    setTimeout(() => audio.star(i), 170 + i * 130);
  }
}

function onLose() {
  Platform.gameplayStop();
  app.renderer.stop();
  openOverlay('ov-lose');
}

async function onNext() {
  const nextLevel = app.save.level;
  closeOverlays();
  await maybeInterstitial(nextLevel);
  startLevel(nextLevel);
}

async function maybeInterstitial(level) {
  if (!Platform.isAdAvailable()) return;
  if (level % 3 !== 0) return;
  await withAd(() => Platform.showInterstitial());
}

async function withAd(run) {
  app.adActive = true;
  audio.suspend();
  try {
    return await run();
  } finally {
    app.adActive = false;
    if (app.save.sound) audio.resume();
  }
}

async function onContinueAd() {
  if (app.busyAd) return;
  app.busyAd = true;
  dom['btn-continue-ad'].disabled = true;

  const result = await withAd(() => Platform.showRewarded());

  app.busyAd = false;
  dom['btn-continue-ad'].disabled = false;

  if (result.available && !result.rewarded) {
    toast(t('adNotFinished'));
    return;
  }
  if (!result.available) toast(t('adUnavailable'));

  if (!app.game.continueWithMoves(5)) return;
  closeOverlays();
  app.renderer.start();
  Platform.gameplayStart();
  scheduleHint();
}

function pauseGame() {
  if (app.screen !== 'game' || app.overlay || app.adActive) return;
  if (!app.game || app.game.state !== 'playing') return;
  openOverlay('ov-pause');
  app.renderer.stop();
  Platform.gameplayStop();
}

function resumeGame() {
  closeOverlays();
  if (app.game.state !== 'playing') return;
  app.renderer.start();
  Platform.gameplayStart();
  scheduleHint();
}

function restartLevel() {
  startLevel(app.game.level);
}

function toMenu() {
  closeOverlays();
  app.renderer.stop();
  Platform.gameplayStop();
  flushSave();
  showScreen('menu');
  refreshMenu();
}

async function onShuffle() {
  if (!app.game || app.game.busy || app.overlay) return;
  if (app.game.shuffles <= 0) {
    toast(t('shuffleUsed'));
    return;
  }
  audio.click();
  await app.game.useShuffle();
  updateShuffle(app.game.shuffles);
  scheduleHint();
}

function scheduleHint() {
  clearTimeout(app.idleTimer);
  app.idleTimer = setTimeout(() => {
    if (app.screen === 'game' && !app.overlay && !app.adActive && app.game.state === 'playing' && !app.game.busy) {
      app.game.showHint();
    }
  }, 7000);
}

/* ---------- Лидеры ---------- */

async function openLeaders() {
  openOverlay('ov-leaders');
  const list = dom['lb-list'];
  list.textContent = '';

  const loading = document.createElement('p');
  loading.className = 'lb-empty';
  loading.textContent = t('loading');
  list.append(loading);

  if (!Platform.available) {
    loading.textContent = t('lbUnavailable');
    return;
  }

  const data = await Platform.getTop(10);
  list.textContent = '';

  if (!data) {
    const message = document.createElement('p');
    message.className = 'lb-empty';
    message.textContent = t('lbUnavailable');
    list.append(message);
    return;
  }

  const entries = Array.isArray(data.entries) ? data.entries : [];
  if (!entries.length) {
    const message = document.createElement('p');
    message.className = 'lb-empty';
    message.textContent = t('lbEmpty');
    list.append(message);
    return;
  }

  for (const entry of entries) {
    const isMe = Boolean(data.userRank) && entry.rank === data.userRank;
    const row = document.createElement('div');
    row.className = isMe ? 'lb-row is-me' : 'lb-row';

    const rank = document.createElement('span');
    rank.className = 'lb-rank';
    rank.textContent = String(entry.rank);

    const name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = entry.player?.publicName || (isMe ? t('you') : t('player'));

    const score = document.createElement('span');
    score.className = 'lb-score';
    score.textContent = i18n.formatNumber(entry.score);

    row.append(rank, name, score);
    list.append(row);
  }
}

/* ---------- Прочее ---------- */

function toggleLang() {
  const next = i18n.lang === 'ru' ? 'en' : 'ru';
  i18n.set(next);
  app.save.lang = next;
  persist();
  updateLangButton();
  refreshMenu();

  if (app.screen === 'game' && app.game) {
    applySnapshot(app.game.snapshot());
    dom['hud-score'].textContent = i18n.formatNumber(app.game.score);
  }

  audio.click();
}

function onReset() {
  const now = Date.now();
  if (now > app.resetArmedUntil) {
    app.resetArmedUntil = now + 3500;
    toast(t('confirmReset'));
    return;
  }

  app.resetArmedUntil = 0;
  const sound = app.save.sound;
  const lang = app.save.lang;
  app.save = normalizeSave({ ...DEFAULT_SAVE, sound, lang });
  flushSave();
  refreshMenu();
  toast(t('resetDone'));
}

/* ---------- Ввод ---------- */

function bindBoardInput() {
  const canvas = dom.board;

  canvas.addEventListener('pointerdown', (event) => {
    if (app.screen !== 'game' || app.overlay || app.adActive) return;
    const cell = app.renderer.hitTest(event.clientX, event.clientY);
    if (!cell) return;
    app.start = {
      r: cell.r,
      c: cell.c,
      x: event.clientX,
      y: event.clientY
    };
    app.game.hint = null;
    scheduleHint();
    event.preventDefault();
  });

  const finish = (event) => {
    if (app.adActive) {
      app.start = null;
      return;
    }
    const start = app.start;
    if (!start) return;
    app.start = null;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const distance = Math.hypot(dx, dy);
    const threshold = Math.max(8, app.renderer.tile * 0.32);

    if (distance >= threshold) {
      let target;
      if (Math.abs(dx) > Math.abs(dy)) {
        target = { r: start.r, c: start.c + (dx > 0 ? 1 : -1) };
      } else {
        target = { r: start.r + (dy > 0 ? 1 : -1), c: start.c };
      }
      if (target.r >= 0 && target.r < ROWS && target.c >= 0 && target.c < COLS) {
        app.game.dragSwap({ r: start.r, c: start.c }, target);
        return;
      }
    }

    app.game.selectTile(start.r, start.c);
  };

  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', () => {
    app.start = null;
  });
}

function bindUi() {
  dom['btn-play'].addEventListener('click', () => {
    audio.ensure();
    audio.click();
    startLevel(app.save.level);
  });

  dom['btn-leaders'].addEventListener('click', () => {
    audio.click();
    openLeaders();
  });

  dom['btn-reset'].addEventListener('click', onReset);
  dom['btn-lang'].addEventListener('click', toggleLang);
  dom['btn-sound-menu'].addEventListener('click', toggleSound);
  dom['btn-pause'].addEventListener('click', pauseGame);
  dom['btn-resume'].addEventListener('click', resumeGame);
  dom['btn-restart'].addEventListener('click', restartLevel);
  dom['btn-pause-sound'].addEventListener('click', toggleSound);
  dom['btn-to-menu'].addEventListener('click', toMenu);
  dom['btn-shuffle'].addEventListener('click', onShuffle);
  dom['btn-next'].addEventListener('click', onNext);
  dom['btn-win-menu'].addEventListener('click', toMenu);
  dom['btn-continue-ad'].addEventListener('click', onContinueAd);
  dom['btn-retry'].addEventListener('click', () => restartLevel());
  dom['btn-lose-menu'].addEventListener('click', toMenu);
  dom['btn-leaders-close'].addEventListener('click', () => {
    closeOverlays();
    audio.click();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      audio.suspend();
      flushSave();
      if (app.screen === 'game' && !app.overlay) pauseGame();
    } else if (app.save.sound) {
      audio.resume();
    }
  });

  window.addEventListener('blur', () => audio.suspend());
  window.addEventListener('focus', () => {
    if (app.save.sound && !app.adActive) audio.resume();
  });

  document.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('dragstart', (event) => event.preventDefault());

  window.addEventListener('pagehide', flushSave);
  window.addEventListener('beforeunload', flushSave);
}

/* ---------- Запуск ---------- */

async function boot() {
  initDom();
  i18n.set(i18n.detect());
  app.save = loadLocal();
  applySound();

  bindUi();
  bindBoardInput();

  app.game = new Game({ onEvent: handleGameEvent });
  app.renderer = new Renderer(dom.board, app.game);
  updateLangButton();

  const platform = await Platform.init();

  if (app.save.lang) i18n.set(app.save.lang);
  else if (platform.lang) i18n.set(platform.lang);
  updateLangButton();

  const cloud = await Platform.loadSave();
  if (cloud) {
    app.save = mergeSaves(app.save, cloud);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(app.save));
    } catch (error) {
      /* игнорируем */
    }
  }

  if (!Platform.available) {
    dom['btn-leaders'].classList.add('is-hidden');
  }

  refreshMenu();
  showScreen('menu');
  hideLoading();
  Platform.ready();
}

if (new URLSearchParams(location.search).has('debug')) {
  window.__gems = app;
}

boot();
