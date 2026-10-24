import { COLS, ROWS } from './game.js';
import { GEM_COLORS } from './board.js';

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const mix = (channel) => {
    const out = amount > 0
      ? channel + (255 - channel) * amount
      : channel * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(out)));
  };
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function gemPath(ctx, type, x, y, r) {
  ctx.beginPath();
  switch (type) {
    case 0:
      ctx.arc(x, y, r * 0.94, 0, Math.PI * 2);
      break;
    case 1:
      roundRect(ctx, x - r * 0.82, y - r * 0.82, r * 1.64, r * 1.64, r * 0.36);
      break;
    case 2:
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.92, y + r * 0.68);
      ctx.lineTo(x - r * 0.92, y + r * 0.68);
      ctx.closePath();
      break;
    case 3:
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.88, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.88, y);
      ctx.closePath();
      break;
    case 4:
      for (let i = 0; i < 6; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 3;
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    default:
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const radius = i % 2 === 0 ? r : r * 0.46;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
  }
}

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.dpr = 1;
    this.side = 0;
    this.tile = 0;
    this.ox = 0;
    this.oy = 0;
    this.radius = 0;
    this.sprites = [];
    this.running = false;
    this.raf = 0;
    this.last = 0;
    this.time = 0;

    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);

    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(this.resize);
      this.observer.observe(canvas.parentElement || canvas);
    }
    this.resize();
  }

  resize() {
    const host = this.canvas.parentElement;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const side = Math.floor(Math.min(rect.width, rect.height));
    if (side < 40) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const changed = side !== this.side || dpr !== this.dpr;

    this.side = side;
    this.dpr = dpr;
    this.canvas.style.width = `${side}px`;
    this.canvas.style.height = `${side}px`;

    if (changed || this.canvas.width !== Math.round(side * dpr)) {
      this.canvas.width = Math.round(side * dpr);
      this.canvas.height = Math.round(side * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    this.pad = Math.round(side * 0.02);
    this.radius = side * 0.05;
    this.tile = (side - this.pad * 2) / COLS;
    this.ox = this.pad;
    this.oy = (side - this.tile * ROWS) / 2;

    this.buildSprites();
  }

  buildSprites() {
    this.sprites = GEM_COLORS.map((color, type) => this.makeSprite(type, color));
  }

  makeSprite(type, color) {
    const gemSize = Math.max(14, this.tile * 0.9);
    const pad = gemSize * 0.1;
    const side = gemSize + pad * 2;
    const scale = Math.min(this.dpr, 2.5);

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(side * scale);
    canvas.height = Math.ceil(side * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    const cx = side / 2;
    const cy = side / 2;
    const r = gemSize / 2;

    gemPath(ctx, type, cx, cy, r);
    const fill = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    fill.addColorStop(0, shade(color, 0.5));
    fill.addColorStop(0.45, color);
    fill.addColorStop(1, shade(color, -0.32));
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.strokeStyle = 'rgba(6, 10, 20, 0.35)';
    ctx.stroke();

    ctx.save();
    gemPath(ctx, type, cx, cy, r);
    ctx.clip();
    const gloss = ctx.createRadialGradient(
      cx - r * 0.35, cy - r * 0.45, 0,
      cx - r * 0.35, cy - r * 0.45, r * 1.05
    );
    gloss.addColorStop(0, 'rgba(255, 255, 255, 0.62)');
    gloss.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(0, 0, side, side);
    ctx.restore();

    return { canvas, side };
  }

  hitTest(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left - this.ox;
    const y = clientY - rect.top - this.oy;
    if (!this.tile || x < 0 || y < 0) return null;
    const c = Math.floor(x / this.tile);
    const r = Math.floor(y / this.tile);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
    return { r, c };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  frame(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;

    this.game.update(dt);
    this.draw();

    this.raf = requestAnimationFrame(this.frame);
  }

  draw() {
    const ctx = this.ctx;
    const side = this.side;
    const tile = this.tile;

    ctx.clearRect(0, 0, side, side);

    ctx.save();
    if (this.game.shake > 0) {
      const power = this.game.shake * tile * 0.2;
      ctx.translate((Math.random() - 0.5) * power, (Math.random() - 0.5) * power);
    }

    roundRect(ctx, 0.5, 0.5, side - 1, side - 1, this.radius);
    const panel = ctx.createLinearGradient(0, 0, side, side);
    panel.addColorStop(0, '#1a2440');
    panel.addColorStop(1, '#111a30');
    ctx.fillStyle = panel;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.stroke();

    const gap = Math.max(1.5, tile * 0.05);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        roundRect(
          ctx,
          this.ox + c * tile + gap,
          this.oy + r * tile + gap,
          tile - gap * 2,
          tile - gap * 2,
          tile * 0.22
        );
        ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
        ctx.fill();
      }
    }

    this.drawHint(ctx);
    this.drawSelection(ctx);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const piece = this.game.board.grid[r][c];
        if (!piece) continue;
        const selected = this.game.selected;
        const isSelected = selected && selected.r === r && selected.c === c;
        const pulse = isSelected ? 1.06 + Math.sin(this.time * 9) * 0.03 : 1;
        const x = this.ox + piece.gx * tile + tile / 2;
        const y = this.oy + piece.gy * tile + tile / 2;
        this.drawSprite(ctx, piece.type, x, y, pulse, 1);
      }
    }

    for (const item of this.game.fading) {
      const progress = Math.min(1, item.t / item.dur);
      const x = this.ox + item.x * tile + tile / 2;
      const y = this.oy + item.y * tile + tile / 2;
      this.drawSprite(ctx, item.tile.type, x, y, 1 - progress * 0.55, 1 - progress * progress);
    }

    for (const p of this.game.particles) {
      const progress = p.life / p.dur;
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(
        this.ox + p.x * tile,
        this.oy + p.y * tile,
        Math.max(1, p.size * tile * (1 - progress * 0.5)),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const popup of this.game.popups) {
      const progress = popup.life / popup.dur;
      const alpha = progress < 0.15 ? progress / 0.15 : 1 - (progress - 0.15) / 0.85;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = popup.color;
      ctx.font = `800 ${Math.round(tile * 0.34)}px -apple-system, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, tile * 0.05);
      ctx.strokeStyle = 'rgba(6, 10, 20, 0.55)';
      const x = this.ox + popup.x * tile;
      const y = this.oy + popup.y * tile - progress * tile * 0.55;
      ctx.strokeText(popup.text, x, y);
      ctx.fillText(popup.text, x, y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  drawSprite(ctx, type, x, y, scale, alpha) {
    const sprite = this.sprites[type];
    if (!sprite) return;
    const size = sprite.side * scale;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(sprite.canvas, x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  drawSelection(ctx) {
    const selected = this.game.selected;
    if (!selected) return;
    const pulse = 0.5 + Math.sin(this.time * 8) * 0.5;
    this.strokeCell(ctx, selected.r, selected.c, `rgba(255, 255, 255, ${0.35 + pulse * 0.35})`, 2.5);
  }

  drawHint(ctx) {
    const hint = this.game.hint;
    if (!hint) return;
    const pulse = 0.5 + Math.sin(this.time * 6) * 0.5;
    const color = `rgba(255, 207, 92, ${0.35 + pulse * 0.55})`;
    this.strokeCell(ctx, hint.a.r, hint.a.c, color, 2.5);
    this.strokeCell(ctx, hint.b.r, hint.b.c, color, 2.5);
  }

  strokeCell(ctx, r, c, color, width) {
    const tile = this.tile;
    const inset = tile * 0.08;
    roundRect(
      ctx,
      this.ox + c * tile + inset,
      this.oy + r * tile + inset,
      tile - inset * 2,
      tile - inset * 2,
      tile * 0.24
    );
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
}
