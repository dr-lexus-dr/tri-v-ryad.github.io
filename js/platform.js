import { i18n } from './i18n.js';

const LEADERBOARD_ID = 'totalScore';
const INTERSTITIAL_COOLDOWN = 60000;

let sdkPromise = null;

/**
 * SDK нужен только внутри Яндекс Игр: там игра открыта в iframe каталога.
 * На GitHub Pages и в локальном запуске страница открыта самостоятельно —
 * сразу работаем в демо-режиме, не дожидаясь SDK и не засоряя консоль.
 * Принудительно включить SDK можно параметром ?sdk=1.
 */
function sdkExpected() {
  if (new URLSearchParams(location.search).has('sdk')) return true;
  try {
    if (window.self !== window.top) return true;
  } catch (error) {
    return true;
  }
  return /(^|\.)yandex\./.test(location.hostname);
}

/**
 * SDK подключается тегом <script> в index.html, как требует документация.
 * Здесь только ждём, пока он загрузится: если сети нет или SDK не ответил,
 * игра продолжает работать в локальном режиме.
 */
function waitForSdk(timeout = 9000) {
  if (window.YaGames) return Promise.resolve(true);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (window.YaGames) {
        clearInterval(timer);
        resolve(true);
      } else if (Date.now() - started >= timeout) {
        clearInterval(timer);
        resolve(false);
      }
    }, 100);
  });

  return sdkPromise;
}

/**
 * Обёртка над Yandex Games SDK. Если SDK недоступен (локальный запуск,
 * выключенная сеть), игра продолжает работать: прогресс хранится локально,
 * реклама пропускается, таблица лидеров показывает заглушку.
 */
export const Platform = {
  ysdk: null,
  player: null,
  leaderboard: null,
  available: false,
  lang: 'ru',
  lastInterstitialAt: 0,
  leaderboardId: LEADERBOARD_ID,

  async init() {
    this.lang = i18n.detect();
    if (!sdkExpected()) return this;

    const loaded = await waitForSdk();
    if (!loaded || !window.YaGames) return this;

    try {
      this.ysdk = await Promise.race([
        window.YaGames.init(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SDK init timeout')), 8000))
      ]);
      this.available = true;

      const sdkLang = this.ysdk?.environment?.i18n?.lang;
      if (sdkLang) {
        this.lang = String(sdkLang).toLowerCase().startsWith('ru') ? 'ru' : 'en';
      }

      try {
        this.player = await this.ysdk.getPlayer({ scopes: false });
      } catch (error) {
        this.player = null;
      }

      try {
        this.leaderboard = this.ysdk.leaderboards || null;
        if (!this.leaderboard && typeof this.ysdk.getLeaderboards === 'function') {
          this.leaderboard = await this.ysdk.getLeaderboards();
        }
      } catch (error) {
        this.leaderboard = null;
      }
    } catch (error) {
      this.available = false;
      this.ysdk = null;
    }

    return this;
  },

  ready() {
    try {
      this.ysdk?.features?.LoadingAPI?.ready?.();
    } catch (error) {
      /* SDK может не поддерживать метод — это не критично */
    }
  },

  gameplayStart() {
    try {
      this.ysdk?.features?.GameplayAPI?.start?.();
    } catch (error) {
      /* не критично */
    }
  },

  gameplayStop() {
    try {
      this.ysdk?.features?.GameplayAPI?.stop?.();
    } catch (error) {
      /* не критично */
    }
  },

  isAdAvailable() {
    return Boolean(this.available && this.ysdk?.adv);
  },

  /** Межстраничная реклама: не чаще раза в минуту. */
  async showInterstitial() {
    if (!this.isAdAvailable()) return { shown: false };
    if (Date.now() - this.lastInterstitialAt < INTERSTITIAL_COOLDOWN) return { shown: false };

    return new Promise((resolve) => {
      let settled = false;
      const finish = (shown) => {
        if (settled) return;
        settled = true;
        this.lastInterstitialAt = Date.now();
        resolve({ shown });
      };

      try {
        this.ysdk.adv.showFullscreenAdv({
          callbacks: {
            onClose: (wasShown) => finish(Boolean(wasShown)),
            onError: () => finish(false),
            onOpen: () => {}
          }
        });
      } catch (error) {
        finish(false);
      }

      setTimeout(() => finish(false), 45000);
    });
  },

  /** Реклама за награду. Возвращает { available, rewarded }. */
  async showRewarded() {
    if (!this.isAdAvailable()) return { available: false, rewarded: false };

    return new Promise((resolve) => {
      let settled = false;
      let rewarded = false;

      const finish = (value, failed = false) => {
        if (settled) return;
        settled = true;
        resolve({ available: !failed, rewarded: value });
      };

      try {
        this.ysdk.adv.showRewardedVideo({
          callbacks: {
            onOpen: () => {},
            onRewarded: () => {
              rewarded = true;
            },
            onClose: () => finish(rewarded),
            onError: () => finish(false, true)
          }
        });
      } catch (error) {
        finish(false, true);
      }

      setTimeout(() => finish(rewarded, !rewarded), 90000);
    });
  },

  async loadSave() {
    if (!this.player) return null;
    try {
      const data = await this.player.getData();
      return data && typeof data.save === 'object' ? data.save : null;
    } catch (error) {
      return null;
    }
  },

  async save(payload) {
    if (!this.player) return false;
    try {
      await this.player.setData({ save: payload }, true);
      return true;
    } catch (error) {
      return false;
    }
  },

  async submitScore(score) {
    if (!this.leaderboard) return false;
    try {
      await this.leaderboard.setLeaderboardScore(this.leaderboardId, Math.round(score));
      return true;
    } catch (error) {
      return false;
    }
  },

  async getTop(quantity = 10) {
    if (!this.leaderboard) return null;
    try {
      return await this.leaderboard.getLeaderboardEntries(this.leaderboardId, {
        quantityTop: quantity,
        includeUser: true,
        quantityAround: 2
      });
    } catch (error) {
      return null;
    }
  }
};
