import { LEADERBOARD, isLeaderboardConfigured } from './config.js';

export { isLeaderboardConfigured };

const NICK_MAX = 16;
const JSONP_TIMEOUT = 8000;

/** Чистит ник от управляющих символов, разметки и формул таблицы. */
export function sanitizeNick(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[=+\-@]+/, '')
    .trim()
    .slice(0, NICK_MAX);
}

/** Отправляет результат в Google Форму (ответ пишется в таблицу). */
export async function submitScore({ nick, score, level }) {
  if (!isLeaderboardConfigured()) throw new Error('leaderboard is not configured');

  const body = new FormData();
  body.append(LEADERBOARD.fields.nick, sanitizeNick(nick));
  body.append(LEADERBOARD.fields.score, String(Math.max(0, Math.floor(Number(score) || 0))));
  body.append(LEADERBOARD.fields.level, String(Math.max(1, Math.floor(Number(level) || 1))));

  await fetch(LEADERBOARD.formAction, { method: 'POST', mode: 'no-cors', body });
  return true;
}

function loadJsonp(url, callbackName, timeout = JSONP_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let timer = 0;

    const cleanup = () => {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('jsonp failed'));
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('jsonp timeout'));
    }, timeout);

    script.src = url;
    document.head.append(script);
  });
}

/**
 * Читает таблицу через Google Visualization API (JSONP, без CORS-проблем).
 * Таблица должна быть открыта на просмотр по ссылке.
 */
export async function loadLeaderboard(limit = 20) {
  if (!isLeaderboardConfigured()) throw new Error('leaderboard is not configured');

  const callback = `gviz_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(LEADERBOARD.sheetId)}/gviz/tq`
    + `?gid=${encodeURIComponent(LEADERBOARD.sheetGid)}&headers=1`
    + `&tqx=responseHandler:${callback}`;

  const payload = await loadJsonp(url, callback);
  const table = payload && payload.table;
  if (!table) throw new Error('bad payload');
  const rawRows = Array.isArray(table.rows) ? table.rows : [];

  const labels = (table.cols || []).map((col) => String((col && col.label) || '').toLowerCase());
  const column = (pattern, fallback) => {
    const index = labels.findIndex((label) => pattern.test(label));
    return index >= 0 ? index : fallback;
  };

  const nickIndex = column(/(ник|name|nick)/, 1);
  const scoreIndex = column(/(очк|score|балл)/, 2);
  const levelIndex = column(/(уров|level)/, 3);

  return rawRows
    .map((row) => {
      const cells = row && row.c ? row.c : [];
      const cell = (index) => (cells[index] && cells[index].v != null ? cells[index].v : '');
      return {
        nick: sanitizeNick(cell(nickIndex)),
        score: Math.floor(Number(cell(scoreIndex)) || 0),
        level: Math.floor(Number(cell(levelIndex)) || 0)
      };
    })
    .filter((row) => row.nick && row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
