export const GEM_TYPES = 6;

export const GEM_COLORS = ['#ff5a6e', '#4aa8ff', '#45d483', '#ffc93c', '#b06bff', '#38e1d6'];

export function defaultMakeTile(type, r, c) {
  return { type, gx: c, gy: r, scale: 1, alpha: 1 };
}

/**
 * Игровое поле «три в ряд»: только логика и координаты, без DOM и канваса.
 * Фишка — объект с полем type и визуальными координатами gx/gy в клетках,
 * которые плавно подтягиваются к своим клеткам в Game.update().
 */
export class Board {
  constructor({ cols = 8, rows = 8, types = 5, makeTile = defaultMakeTile } = {}) {
    this.cols = cols;
    this.rows = rows;
    this.types = types;
    this.makeTile = makeTile;
    this.grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  }

  inBounds(r, c) {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
  }

  get(r, c) {
    return this.inBounds(r, c) ? this.grid[r][c] : null;
  }

  set(r, c, tile) {
    if (this.inBounds(r, c)) this.grid[r][c] = tile;
  }

  clearAll() {
    for (let r = 0; r < this.rows; r++) this.grid[r].fill(null);
  }

  allTiles() {
    const tiles = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tile = this.grid[r][c];
        if (tile) tiles.push(tile);
      }
    }
    return tiles;
  }

  pickSafeType(r, c) {
    const forbidden = new Set();
    const left1 = this.get(r, c - 1);
    const left2 = this.get(r, c - 2);
    if (left1 && left2 && left1.type === left2.type) forbidden.add(left1.type);
    const up1 = this.get(r - 1, c);
    const up2 = this.get(r - 2, c);
    if (up1 && up2 && up1.type === up2.type) forbidden.add(up1.type);

    const pool = [];
    for (let type = 0; type < this.types; type++) {
      if (!forbidden.has(type)) pool.push(type);
    }
    if (!pool.length) return (Math.random() * this.types) | 0;
    return pool[(Math.random() * pool.length) | 0];
  }

  fill(types = this.types) {
    this.types = Math.max(3, Math.min(GEM_TYPES, types | 0));
    for (let attempt = 0; attempt < 40; attempt++) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const type = this.pickSafeType(r, c);
          this.grid[r][c] = this.makeTile(type, r, c);
        }
      }
      if (!this.findMatches().length && this.hasMove()) return true;
    }
    return false;
  }

  /** Группы совпадений: [{ type, cells: [[r, c], ...] }, ...] */
  findMatches() {
    const groups = [];

    for (let r = 0; r < this.rows; r++) {
      let c = 0;
      while (c < this.cols) {
        const tile = this.grid[r][c];
        if (!tile) {
          c++;
          continue;
        }
        let end = c + 1;
        while (end < this.cols && this.grid[r][end] && this.grid[r][end].type === tile.type) end++;
        if (end - c >= 3) {
          const cells = [];
          for (let k = c; k < end; k++) cells.push([r, k]);
          groups.push({ type: tile.type, cells });
        }
        c = end;
      }
    }

    for (let c = 0; c < this.cols; c++) {
      let r = 0;
      while (r < this.rows) {
        const tile = this.grid[r][c];
        if (!tile) {
          r++;
          continue;
        }
        let end = r + 1;
        while (end < this.rows && this.grid[end][c] && this.grid[end][c].type === tile.type) end++;
        if (end - r >= 3) {
          const cells = [];
          for (let k = r; k < end; k++) cells.push([k, c]);
          groups.push({ type: tile.type, cells });
        }
        r = end;
      }
    }

    return groups;
  }

  swapCells(r1, c1, r2, c2) {
    const a = this.grid[r1][c1];
    this.grid[r1][c1] = this.grid[r2][c2];
    this.grid[r2][c2] = a;
  }

  swap(a, b) {
    this.swapCells(a.r, a.c, b.r, b.c);
  }

  isAdjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  /** Подсказка: первый найденный обмен, дающий совпадение. */
  findHint() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const a = this.grid[r][c];
        if (!a) continue;

        if (c + 1 < this.cols) {
          const b = this.grid[r][c + 1];
          if (b && b.type !== a.type) {
            this.swapCells(r, c, r, c + 1);
            const ok = this.findMatches().length > 0;
            this.swapCells(r, c, r, c + 1);
            if (ok) return { a: { r, c }, b: { r, c: c + 1 } };
          }
        }

        if (r + 1 < this.rows) {
          const b = this.grid[r + 1][c];
          if (b && b.type !== a.type) {
            this.swapCells(r, c, r + 1, c);
            const ok = this.findMatches().length > 0;
            this.swapCells(r, c, r + 1, c);
            if (ok) return { a: { r, c }, b: { r: r + 1, c } };
          }
        }
      }
    }
    return null;
  }

  hasMove() {
    return this.findHint() !== null;
  }

  /**
   * Перемешивает типы существующих фишек, пока не получится поле
   * без готовых совпадений и хотя бы с одним доступным ходом.
   */
  shuffle() {
    const tiles = this.allTiles();
    const types = new Array(tiles.length);

    for (let attempt = 0; attempt < 80; attempt++) {
      for (let i = 0; i < tiles.length; i++) types[i] = tiles[i].type;
      for (let i = types.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const tmp = types[i];
        types[i] = types[j];
        types[j] = tmp;
      }
      for (let i = 0; i < tiles.length; i++) tiles[i].type = types[i];

      if (!this.findMatches().length && this.hasMove()) return true;
    }

    this.fill(this.types);
    return false;
  }

  /**
   * Опускает фишки вниз и добавляет новые сверху.
   * Возвращает массив новых фишек (их gx/gy уже стоят над полем).
   */
  collapse() {
    const spawned = [];

    for (let c = 0; c < this.cols; c++) {
      let write = this.rows - 1;

      for (let r = this.rows - 1; r >= 0; r--) {
        const tile = this.grid[r][c];
        if (!tile) continue;
        if (write !== r) {
          this.grid[write][c] = tile;
          this.grid[r][c] = null;
        }
        write--;
      }

      let above = -1;
      for (let r = write; r >= 0; r--) {
        const type = (Math.random() * this.types) | 0;
        const tile = this.makeTile(type, r, c);
        tile.gx = c;
        tile.gy = above;
        above -= 1;
        this.grid[r][c] = tile;
        spawned.push(tile);
      }
    }

    return spawned;
  }
}
