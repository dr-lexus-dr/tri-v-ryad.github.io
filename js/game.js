import { Board, GEM_TYPES, GEM_COLORS } from './board.js';
import { audio } from './audio.js';

export const COLS = 8;
export const ROWS = 8;

const SWAP_MS = 165;
const CLEAR_MS = 165;
const FALL_MS = 235;
const ENTRY_MS = 430;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Настройки уровня: ходы, цели и количество цветов. */
export function levelConfig(level) {
  const n = Math.max(1, level | 0);
  const types = n <= 5 ? 5 : GEM_TYPES;
  const moves = Math.max(14, 30 - Math.floor((n - 1) * 0.7));

  const first = (n * 3) % types;
  const second = (first + 2) % types;

  let goals;
  if (n <= 9) {
    goals = [{ type: first, need: Math.max(10, Math.round(moves * 0.55)) }];
  } else {
    goals = [
      { type: first, need: Math.max(8, Math.round(moves * 0.5)) },
      { type: second, need: Math.max(7, Math.round(moves * 0.42)) }
    ];
  }

  return {
    level: n,
    moves,
    types,
    goals: goals.map((goal) => ({ ...goal, got: 0 }))
  };
}

export class Game {
  constructor({ onEvent } = {}) {
    this.onEvent = typeof onEvent === 'function' ? onEvent : () => {};
    this.board = new Board({
      cols: COLS,
      rows: ROWS,
      types: 5,
      makeTile: (type, r, c) => this.createTile(type, r, c)
    });

    this.gen = 0;
    this.state = 'idle';
    this.level = 1;
    this.score = 0;
    this.movesLeft = 0;
    this.movesTotal = 0;
    this.goals = [];
    this.shuffles = 0;
    this.selected = null;
    this.hint = null;
    this.busy = false;

    this.fading = [];
    this.particles = [];
    this.popups = [];
    this.shake = 0;
  }

  createTile(type, r, c) {
    return { type, gx: c, gy: r, scale: 1, alpha: 1 };
  }

  emit(name, data) {
    this.onEvent(name, data);
  }

  snapshot() {
    return {
      level: this.level,
      score: this.score,
      movesLeft: this.movesLeft,
      movesTotal: this.movesTotal,
      goals: this.goals.map((goal) => ({ ...goal })),
      shuffles: this.shuffles
    };
  }

  startLevel(level) {
    this.gen++;
    const gen = this.gen;
    const cfg = levelConfig(level);

    this.level = cfg.level;
    this.movesTotal = cfg.moves;
    this.movesLeft = cfg.moves;
    this.goals = cfg.goals;
    this.score = 0;
    this.state = 'playing';
    this.busy = true;
    this.selected = null;
    this.hint = null;
    this.fading.length = 0;
    this.particles.length = 0;
    this.popups.length = 0;
    this.shake = 0;
    this.shuffles = 1;

    this.board.types = cfg.types;
    this.board.fill(cfg.types);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = this.board.get(r, c);
        if (tile) {
          tile.gx = c;
          tile.gy = r - ROWS - 2;
        }
      }
    }

    this.emit('level', this.snapshot());

    setTimeout(() => {
      if (gen === this.gen) this.busy = false;
    }, ENTRY_MS);

    return cfg;
  }

  isPlaying() {
    return this.state === 'playing';
  }

  selectTile(r, c) {
    if (this.busy || this.state !== 'playing') return;
    if (!this.board.get(r, c)) return;

    this.hint = null;
    this.emit('hint', null);

    if (!this.selected) {
      this.selected = { r, c };
      audio.select();
      this.emit('select', this.selected);
      return;
    }

    if (this.selected.r === r && this.selected.c === c) {
      this.selected = null;
      this.emit('select', null);
      return;
    }

    if (this.board.isAdjacent(this.selected, { r, c })) {
      const from = this.selected;
      this.selected = null;
      this.emit('select', null);
      this.trySwap(from, { r, c });
      return;
    }

    this.selected = { r, c };
    audio.select();
    this.emit('select', this.selected);
  }

  dragSwap(from, to) {
    if (this.busy || this.state !== 'playing') return;
    if (!from || !to || !this.board.isAdjacent(from, to)) {
      this.selected = null;
      this.emit('select', null);
      return;
    }
    this.selected = null;
    this.hint = null;
    this.emit('select', null);
    this.emit('hint', null);
    this.trySwap(from, to);
  }

  async trySwap(a, b) {
    if (this.busy || this.state !== 'playing') return;
    const gen = this.gen;

    this.busy = true;
    this.board.swap(a, b);
    audio.swap();
    await wait(SWAP_MS);
    if (gen !== this.gen) return;

    if (!this.board.findMatches().length) {
      this.board.swap(a, b);
      this.shake = 0.22;
      audio.invalid();
      await wait(SWAP_MS + 30);
      if (gen !== this.gen) return;
      this.busy = false;
      return;
    }

    this.movesLeft = Math.max(0, this.movesLeft - 1);
    this.emit('moves', this.movesLeft);

    await this.resolve(gen);
    if (gen !== this.gen) return;
    this.busy = false;
    this.checkEnd();
  }

  async resolve(gen) {
    let chain = 0;

    while (gen === this.gen) {
      const groups = this.board.findMatches();
      if (!groups.length) break;
      chain++;
      await this.clearGroups(groups, chain);
      if (gen !== this.gen) return;
      this.board.collapse();
      await wait(FALL_MS);
    }

    if (gen !== this.gen) return;

    if (!this.board.hasMove()) {
      this.board.shuffle();
      this.emit('boardChange');
      this.emit('shuffle', { auto: true });
      await wait(260);
    }
  }

  async clearGroups(groups, chain) {
    const seen = new Set();
    let points = 0;

    for (const group of groups) {
      let sumX = 0;
      let sumY = 0;
      for (const [r, c] of group.cells) {
        sumX += c + 0.5;
        sumY += r + 0.5;
      }
      const cx = sumX / group.cells.length;
      const cy = sumY / group.cells.length;
      const size = group.cells.length;
      const gain = size * 10 * chain + (size >= 5 ? 60 : size === 4 ? 30 : 0);
      points += gain;

      this.popups.push({
        x: cx,
        y: cy,
        text: `+${gain}`,
        life: 0,
        dur: 0.85,
        color: chain > 1 ? '#ffd166' : '#ffffff'
      });
      this.spawnBurst(cx, cy, group.type, Math.min(12, 4 + size));

      for (const [r, c] of group.cells) {
        const key = r * COLS + c;
        if (seen.has(key)) continue;
        seen.add(key);

        const tile = this.board.get(r, c);
        if (!tile) continue;

        const goal = this.goals.find((item) => item.type === tile.type);
        if (goal && goal.got < goal.need) goal.got += 1;

        this.fading.push({
          tile,
          x: c,
          y: r,
          t: 0,
          delay: Math.random() * 0.03,
          dur: 0.24
        });
        this.board.set(r, c, null);
      }
    }

    this.score += points;
    this.emit('score', this.score);
    this.emit('goals', this.goals);
    audio.match(chain);

    this.shake = Math.min(0.4, Math.max(this.shake, 0.05 * chain));

    await wait(CLEAR_MS);
  }

  spawnBurst(x, y, type, count) {
    const color = GEM_COLORS[type] || '#ffffff';
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.9 + Math.random() * 2.4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        life: 0,
        dur: 0.42 + Math.random() * 0.3,
        size: 0.06 + Math.random() * 0.09,
        color
      });
    }
  }

  async useShuffle() {
    if (this.busy || this.state !== 'playing' || this.shuffles <= 0) return false;
    const gen = this.gen;

    this.shuffles -= 1;
    this.busy = true;
    this.selected = null;
    this.hint = null;
    this.emit('select', null);
    this.emit('shuffles', this.shuffles);

    this.board.shuffle();
    this.emit('boardChange');
    audio.shuffle();

    await wait(300);
    if (gen !== this.gen) return true;

    this.busy = false;
    return true;
  }

  showHint() {
    if (this.busy || this.state !== 'playing') return;
    this.hint = this.board.findHint();
    this.emit('hint', this.hint);
  }

  checkEnd() {
    if (this.state !== 'playing') return;

    if (this.goals.every((goal) => goal.got >= goal.need)) {
      this.finish(true);
    } else if (this.movesLeft <= 0) {
      this.finish(false);
    }
  }

  finish(won) {
    this.selected = null;
    this.emit('select', null);

    if (!won) {
      this.state = 'lost';
      audio.lose();
      this.emit('lose', { level: this.level });
      return;
    }

    const bonus = this.movesLeft * 50;
    this.score += bonus;

    const ratio = this.movesTotal ? this.movesLeft / this.movesTotal : 0;
    const stars = ratio >= 0.4 ? 3 : ratio >= 0.15 ? 2 : 1;

    this.state = 'won';
    this.emit('score', this.score);
    audio.win();
    this.emit('win', {
      level: this.level,
      score: this.score,
      bonus,
      stars,
      movesLeft: this.movesLeft
    });
  }

  continueWithMoves(extra = 5) {
    if (this.state !== 'lost') return false;
    this.state = 'playing';
    this.movesLeft += extra;
    this.emit('moves', this.movesLeft);
    this.emit('resume');
    return true;
  }

  update(dt) {
    const ease = 1 - Math.exp(-17 * dt);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = this.board.grid[r][c];
        if (!tile) continue;
        tile.gx += (c - tile.gx) * ease;
        tile.gy += (r - tile.gy) * ease;
        if (Math.abs(c - tile.gx) < 0.004) tile.gx = c;
        if (Math.abs(r - tile.gy) < 0.004) tile.gy = r;
      }
    }

    for (let i = this.fading.length - 1; i >= 0; i--) {
      const item = this.fading[i];
      if (item.delay > 0) {
        item.delay -= dt;
        continue;
      }
      item.t += dt;
      if (item.t >= item.dur) this.fading.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.dur) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += 9 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life += dt;
      if (p.life >= p.dur) this.popups.splice(i, 1);
    }

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.7);
  }
}
