export const REPO_OWNER = 'dr-lexus-dr';
export const REPO_NAME = 'tri-v-ryad.github.io';

const DATA_URL = 'data/leaderboard.json';
const NICK_MAX = 16;

/** Чистит ник от управляющих символов и разметки, оставляет одну строку. */
export function sanitizeNick(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NICK_MAX);
}

/** Читает таблицу из репозитория: файл обновляет GitHub Actions. */
export async function loadLeaderboard(limit = 20) {
  const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const payload = await response.json();
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.scores)
      ? payload.scores
      : [];

  return rows
    .map((row) => ({
      nick: sanitizeNick(row?.nick),
      score: Math.max(0, Math.floor(Number(row?.score) || 0)),
      level: Math.max(0, Math.floor(Number(row?.level) || 0))
    }))
    .filter((row) => row.nick && row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Ссылка на создание issue с результатом: его обработает workflow. */
export function scoreIssueUrl({ nick, score, level }) {
  const safeNick = sanitizeNick(nick);
  const safeScore = Math.max(0, Math.floor(Number(score) || 0));
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));

  const title = `[score] ${safeNick} — ${safeScore}`;
  const body = [
    '<!-- gem-score -->',
    `nick=${safeNick}`,
    `score=${safeScore}`,
    `level=${safeLevel}`,
    '',
    'Отправлено из игры «Самоцветы».'
  ].join('\n');

  return `https://github.com/${REPO_OWNER}/${REPO_NAME}/issues/new`
    + `?title=${encodeURIComponent(title)}`
    + `&body=${encodeURIComponent(body)}`;
}
