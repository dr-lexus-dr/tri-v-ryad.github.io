const STRINGS = {
  ru: {
    title: 'Самоцветы',
    subtitle: 'Три в ряд',
    level: 'Уровень',
    levelShort: 'Ур.',
    levelN: 'Уровень {n}',
    totalScore: 'Всего очков',
    score: 'Очки',
    best: 'Рекорд',
    play: 'Играть',
    leaderboard: 'Лидеры',
    reset: 'Сначала',
    menuHint: 'Меняйте местами соседние самоцветы и собирайте три в ряд',
    sound: 'Звук',
    pause: 'Пауза',
    moves: 'ходов',
    shuffle: 'Перемешать',
    shuffleUsed: 'Перемешивание уже использовано',
    paused: 'Пауза',
    resume: 'Продолжить',
    restart: 'Заново',
    menu: 'В меню',
    levelComplete: 'Уровень пройден!',
    bonus: 'Бонус за ходы',
    next: 'Дальше',
    levelFailed: 'Ходы закончились',
    levelFailedText: 'Не хватило самую малость. Продолжите с пятью дополнительными ходами.',
    moreMoves: '+5 ходов',
    watchAd: 'Смотреть рекламу',
    rewardMoves: 'и получить +5 ходов',
    extraMoves: '+5 ходов',
    retry: 'Заново',
    close: 'Закрыть',
    loading: 'Загрузка…',
    adLabel: 'Реклама',
    adUnavailable: 'Реклама недоступна — ходы добавлены',
    noMoves: 'Нет доступных ходов — поле перемешано',
    adNotFinished: 'Досмотрите рекламу до конца, чтобы получить ходы',
    player: 'Игрок',
    lbUnavailable: 'Таблица лидеров пока недоступна',
    lbEmpty: 'Пока никто не отправил результат. Будьте первым!',
    lbSignIn: 'Войдите в аккаунт Яндекса, чтобы попасть в таблицу лидеров',
    you: 'Вы',
    newRecord: 'Новый рекорд!',
    confirmReset: 'Сбросить прогресс и начать с первого уровня?',
    resetDone: 'Прогресс сброшен',
    goal: 'Цель',
    nickTitle: 'Как вас зовут?',
    nickHint: 'Ник увидят все в таблице лидеров. Уникальность не проверяется.',
    nickPlaceholder: 'Ваш ник',
    nickSave: 'Сохранить',
    nickSkip: 'Пропустить',
    nickDefault: 'Гость',
    changeNick: 'Сменить ник',
    submitScore: 'Отправить в таблицу',
    submitSent: 'Отправлено на проверку',
    submitHint: 'Откроется GitHub: проверьте ник и нажмите «Submit new issue».',
    lbNote: 'Результаты появляются после проверки, обычно в течение минуты.'
  },
  en: {
    title: 'Gems',
    subtitle: 'Match three',
    level: 'Level',
    levelShort: 'Lvl',
    levelN: 'Level {n}',
    totalScore: 'Total score',
    score: 'Score',
    best: 'Best',
    play: 'Play',
    leaderboard: 'Leaders',
    reset: 'Restart',
    menuHint: 'Swap neighbouring gems to line up three or more',
    sound: 'Sound',
    pause: 'Pause',
    moves: 'moves',
    shuffle: 'Shuffle',
    shuffleUsed: 'Shuffle already used',
    paused: 'Paused',
    resume: 'Resume',
    restart: 'Restart',
    menu: 'Menu',
    levelComplete: 'Level complete!',
    bonus: 'Moves bonus',
    next: 'Next',
    levelFailed: 'Out of moves',
    levelFailedText: 'So close. Continue with five extra moves.',
    moreMoves: '+5 moves',
    watchAd: 'Watch an ad',
    rewardMoves: 'and get +5 moves',
    extraMoves: '+5 moves',
    retry: 'Retry',
    close: 'Close',
    loading: 'Loading…',
    adLabel: 'Ad',
    adUnavailable: 'Ad unavailable — moves added',
    noMoves: 'No moves left — the board was reshuffled',
    adNotFinished: 'Watch the ad to the end to get the moves',
    player: 'Player',
    lbUnavailable: 'Leaderboard is unavailable',
    lbEmpty: 'No scores yet. Be the first!',
    lbSignIn: 'Sign in with Yandex to join the leaderboard',
    you: 'You',
    newRecord: 'New record!',
    confirmReset: 'Reset progress and start from level one?',
    resetDone: 'Progress reset',
    goal: 'Goal',
    nickTitle: 'What is your name?',
    nickHint: 'Your nickname is shown to everyone in the leaderboard. It does not have to be unique.',
    nickPlaceholder: 'Your nickname',
    nickSave: 'Save',
    nickSkip: 'Skip',
    nickDefault: 'Guest',
    changeNick: 'Change nickname',
    submitScore: 'Submit to leaderboard',
    submitSent: 'Sent for review',
    submitHint: 'GitHub will open: check your nickname and click "Submit new issue".',
    lbNote: 'Scores appear after review, usually within a minute.'
  }
};

let current = 'ru';

export const i18n = {
  get lang() { return current; },

  set(lang) {
    current = STRINGS[lang] ? lang : 'ru';
    document.documentElement.lang = current;
    this.applyStatic();
    return current;
  },

  t(key, vars) {
    const bag = STRINGS[current] || STRINGS.ru;
    let text = bag[key] ?? STRINGS.ru[key] ?? key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  },

  applyStatic() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = this.t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', this.t(el.dataset.i18nAria));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', this.t(el.dataset.i18nPlaceholder));
    });
  },

  formatNumber(value) {
    const n = Math.round(Number(value) || 0);
    try {
      return n.toLocaleString(current === 'ru' ? 'ru-RU' : 'en-US');
    } catch {
      return String(n);
    }
  },

  detect() {
    const candidates = [
      ...(navigator.languages || []),
      navigator.language || '',
      navigator.userLanguage || ''
    ].map((code) => String(code).toLowerCase());

    return candidates.some((code) => code.startsWith('ru')) ? 'ru' : 'en';
  }
};

export const t = (key, vars) => i18n.t(key, vars);
