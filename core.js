// core.js — shared config, math helpers, input, settings and sound

const CONFIG = {
  MAP_HALF: 1800,          // map spans -1800..1800 on X and Z (3.6 km square)
  SEA_Y: -0.6,             // sea level
  DAY_LENGTH: 720,         // real seconds for a full 24-hour day
  START_HOUR: 17.5,
  CITY: { x0: -1000, z0: -935, pitch: 110, nx: 17, nz: 17, block: 92, road: 18 },
};

const U = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  angleDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  },
};

// Seeded random so the city layout is identical every time
const RNG = (() => {
  let s = 1337;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();

const Input = {
  keys: {},
  pressedKeys: {},
  mouseDX: 0,
  mouseDY: 0,
  locked: false,
  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) this.pressedKeys[e.code] = true;
      this.keys[e.code] = true;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    window.addEventListener('mousemove', (e) => {
      if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    canvas.addEventListener('click', () => Game.captureMouse());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      Game.onLockChange(this.locked);
    });
  },
  down(code) { return !!this.keys[code]; },
  pressed(code) { return !!this.pressedKeys[code]; },
  endFrame() { this.pressedKeys = {}; this.mouseDX = 0; this.mouseDY = 0; },
};

const DEFAULT_SETTINGS = { sensitivity: 0.0022, volume: 0.7, quality: 'high', minimap: true, invertY: false };

const Settings = {
  data: { ...DEFAULT_SETTINGS },
  load() {
    try { Object.assign(this.data, JSON.parse(localStorage.getItem('gc1-settings') || '{}')); } catch (e) { /* ignore */ }
  },
  save() {
    try { localStorage.setItem('gc1-settings', JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  },
  reset() { this.data = { ...DEFAULT_SETTINGS }; this.save(); },
};

// Procedural sound effects (engine hum, horn, chimes) via Web Audio
const SFX = {
  ctx: null, master: null, engineOsc: null, engineGain: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.setVolume(Settings.data.volume);
  },
  setVolume(v) { if (this.master) this.master.gain.value = v * 0.6; },
  engine(speed, inCar) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, s = Math.abs(speed);
    this.engineOsc.frequency.setTargetAtTime(inCar ? 55 + s * 4 : 40, t, 0.1);
    this.engineGain.gain.setTargetAtTime(inCar ? Math.min(0.09, 0.02 + s * 0.0025) : 0, t, 0.1);
  },
  beep(freq = 880, dur = 0.18, vol = 0.25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  },
};
