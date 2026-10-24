/**
 * Настройки таблицы лидеров Google.
 *
 * 1. Создайте форму с тремя вопросами: ник, очки, уровень.
 * 2. Привяжите к форме таблицу ответов.
 * 3. Впишите сюда адрес formResponse, ID полей entry.* и ID таблицы.
 * Подробная инструкция — в README, раздел «Таблица лидеров».
 */
export const LEADERBOARD = {
  // https://docs.google.com/forms/d/e/<ID>/formResponse
  formAction: 'https://docs.google.com/forms/d/e/1FAIpQLSfjO8pUWnsCaciJDPmfl812uMSGCCSx1afKykOcBnbi1fwBcg/formResponse',

  // ID полей формы, например 'entry.123456789'
  fields: {
    nick: 'entry.479984232',
    score: 'entry.668503521',
    level: 'entry.567444949'
  },

  // ID таблицы: docs.google.com/spreadsheets/d/<ID>/edit
  sheetId: '165a4_c68hwCrFIuuFrYs5trwUEQ0X2KSZRDwK8y386A',

  // gid листа с ответами: .../edit#gid=<GID>
  sheetGid: '0'
};

export function isLeaderboardConfigured() {
  return Boolean(
    LEADERBOARD.formAction
    && LEADERBOARD.fields.nick
    && LEADERBOARD.fields.score
    && LEADERBOARD.fields.level
    && LEADERBOARD.sheetId
  );
}
