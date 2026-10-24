/**
 * Звук без внешних файлов: короткие синтезированные ноты на WebAudio.
 * Контекст создаётся только после действия пользователя.
 */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.paused = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    if (this.master) {
      this.master.gain.value = this.enabled ? 0.42 : 0;
    }
  }

  /** Пауза звука при потере фокуса и на время рекламы. */
  suspend() {
    this.paused = true;
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  resume() {
    this.paused = false;
    if (this.enabled && this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  tone(freq, { type = 'sine', dur = 0.12, vol = 0.22, slide = 0, delay = 0 } = {}) {
    if (!this.enabled || this.paused) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;

    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), start + dur);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  select() {
    this.tone(660, { type: 'triangle', dur: 0.06, vol: 0.12 });
  }

  swap() {
    this.tone(420, { type: 'sine', dur: 0.09, vol: 0.16, slide: 120 });
  }

  invalid() {
    this.tone(180, { type: 'square', dur: 0.12, vol: 0.1, slide: -40 });
  }

  match(chain = 1) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    const base = scale[Math.min(chain - 1, scale.length - 1)];
    this.tone(base, { type: 'triangle', dur: 0.14, vol: 0.2 });
    this.tone(base * 1.5, { type: 'sine', dur: 0.18, vol: 0.1, delay: 0.05 });
  }

  shuffle() {
    this.tone(300, { type: 'sine', dur: 0.18, vol: 0.14, slide: 260 });
    this.tone(500, { type: 'sine', dur: 0.16, vol: 0.1, delay: 0.08 });
  }

  click() {
    this.tone(520, { type: 'sine', dur: 0.05, vol: 0.1 });
  }

  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      this.tone(freq, { type: 'triangle', dur: 0.28, vol: 0.18, delay: i * 0.09 });
    });
  }

  lose() {
    [392, 349.23, 293.66].forEach((freq, i) => {
      this.tone(freq, { type: 'sine', dur: 0.26, vol: 0.16, delay: i * 0.12 });
    });
  }

  star(index = 0) {
    this.tone(880 + index * 180, { type: 'triangle', dur: 0.16, vol: 0.14 });
  }
}

export const audio = new AudioEngine();
