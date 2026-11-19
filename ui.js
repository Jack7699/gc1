// ui.js — menus, HUD, toasts, dialogue and minimap

const UI = {
  els: {},
  mm: null,
  mapImg: null,
  settingsFrom: 'screen-menu',

  init() {
    const ids = [
      'loader', 'screen-menu', 'screen-pause', 'screen-settings', 'screen-about',
      'hud', 'hint', 'health-fill', 'money', 'level', 'mission-title', 'mission-objective',
      'prompt', 'dialogue', 'dialogue-name', 'dialogue-line', 'toasts', 'wasted',
      'minimap', 'vehicle-hud', 'speed', 'vehicle-name',
      'set-sens', 'set-vol', 'set-quality', 'set-minimap', 'set-invert',
    ];
    ids.forEach((id) => (this.els[id] = document.getElementById(id)));
    this.mm = this.els['minimap'].getContext('2d');
    this.buildMap();
    this.bind();
    this.syncForm();
    this.applySettings();
  },

  bind() {
    const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
    on('btn-play', () => Game.startNewGame());
    on('btn-settings-menu', () => this.openSettings('screen-menu'));
    on('btn-about-menu', () => this.showScreen('screen-about'));
    on('btn-resume', () => Game.resume());
    on('btn-settings-pause', () => this.openSettings('screen-pause'));
    on('btn-quit', () => Game.quitToMenu());
    on('btn-settings-reset', () => { Settings.reset(); this.syncForm(); this.applySettings(); });
    this.els.hint.addEventListener('click', () => Game.captureMouse());

    document.querySelectorAll('[data-back]').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.dataset.back === 'settings') this.closeSettings();
        else this.showScreen(b.dataset.back);
      });
    });

    const live = (id, key, read) => {
      document.getElementById(id).addEventListener('input', (e) => {
        Settings.data[key] = read(e.target);
        Settings.save();
        this.applySettings();
      });
    };
    live('set-sens', 'sensitivity', (t) => parseFloat(t.value));
    live('set-vol', 'volume', (t) => parseFloat(t.value));
    live('set-quality', 'quality', (t) => t.value);
    live('set-minimap', 'minimap', (t) => t.checked);
    live('set-invert', 'invertY', (t) => t.checked);
  },

  showScreen(name) {
    for (const id of ['loader', 'screen-menu', 'screen-pause', 'screen-settings', 'screen-about']) {
      this.els[id].classList.toggle('hidden', id !== name);
    }
  },

  openSettings(from) {
    this.settingsFrom = from;
    this.syncForm();
    this.showScreen('screen-settings');
  },

  closeSettings() { this.showScreen(this.settingsFrom || 'screen-menu'); },

  hud(show) { this.els.hud.classList.toggle('hidden', !show); },

  syncForm() {
    const d = Settings.data;
    this.els['set-sens'].value = d.sensitivity;
    this.els['set-vol'].value = d.volume;
    this.els['set-quality'].value = d.quality;
    this.els['set-minimap'].checked = d.minimap;
    this.els['set-invert'].checked = d.invertY;
  },

  applySettings() {
    SFX.setVolume(Settings.data.volume);
    if (Game.renderer) Game.applyQuality();
    this.els.minimap.classList.toggle('hidden', !Settings.data.minimap);
  },

  toast(title, text, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    const b = document.createElement('b');
    b.textContent = title;
    const sp = document.createElement('span');
    sp.textContent = text || '';
    el.append(b, sp);
    this.els.toasts.appendChild(el);
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3800);
  },

  dialogue(name, line) {
    this.els['dialogue-name'].textContent = name;
    this.els['dialogue-line'].textContent = line;
    this.els.dialogue.classList.remove('hidden');
    clearTimeout(this._dlg);
    this._dlg = setTimeout(() => this.els.dialogue.classList.add('hidden'), 6500);
  },

  updateHUD(s) {
    const e = this.els;
    e['health-fill'].style.width = U.clamp(s.health, 0, 100) + '%';
    e['money'].textContent = '$' + Math.floor(s.money).toLocaleString('en-US');
    e['level'].textContent = `RESPECT LV ${Math.floor(s.xp / 200) + 1} · ${s.xp % 200} / 200 XP`;
    e['mission-title'].textContent = s.mission ? s.mission.title : 'All missions complete';
    e['mission-objective'].textContent = s.mission
      ? `${s.stepNum}/${s.stepTotal} · ${s.step.text}`
      : 'Explore Grand City';
    e['prompt'].textContent = s.prompt || '';
    e['prompt'].classList.toggle('hidden', !s.prompt);
    e['vehicle-hud'].classList.toggle('hidden', !s.car);
    if (s.car) {
      e['speed'].textContent = Math.round(s.speed);
      e['vehicle-name'].textContent = s.car.name;
    }
  },

  // Builds a low-resolution picture of the whole map once; the minimap rotates and crops it each frame
  buildMap() {
    const H = CONFIG.MAP_HALF, S = 0.4, size = Math.round(H * 2 * S), C = CONFIG.CITY;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    const m = (v) => (v + H) * S;

    g.fillStyle = '#1d6583';
    g.fillRect(0, 0, size, size);
    g.fillStyle = '#56784a';
    g.beginPath();
    g.moveTo(m(World.coastAt(-H)), 0);
    for (let z = -H; z <= H; z += 20) g.lineTo(m(World.coastAt(z)), m(z));
    g.lineTo(size, size);
    g.lineTo(size, 0);
    g.closePath();
    g.fill();
    g.fillStyle = '#b89f6b';
    g.fillRect(m(950), 0, size - m(950), size);
    g.fillStyle = '#4f5560';
    g.fillRect(m(C.x0 - 9), m(C.z0 - 9), (C.nx * C.pitch + 18) * S, (C.nz * C.pitch + 18) * S);
    for (let i = 0; i < C.nx; i++) {
      for (let j = 0; j < C.nz; j++) {
        const cx = C.x0 + i * C.pitch + C.pitch / 2, cz = C.z0 + j * C.pitch + C.pitch / 2;
        g.fillStyle = World.zoneAt(cx, cz) === 'park' ? '#4f8a3c' : '#9a9da3';
        g.fillRect(m(cx - C.block / 2), m(cz - C.block / 2), C.block * S, C.block * S);
      }
    }
    this.mapImg = cv;
  },

  // px,pz = world position at centre; h = forward heading; marks = [{x,z,color}]; vehicles = list
  drawMinimap(px, pz, h, marks, vehicles) {
    const g = this.mm, R = 100, S = 0.4, H = CONFIG.MAP_HALF;
    const pu = (px + H) * S, pv = (pz + H) * S;
    g.clearRect(0, 0, 200, 200);

    g.save();
    g.beginPath();
    g.arc(R, R, R - 2, 0, Math.PI * 2);
    g.closePath();
    g.clip();
    g.fillStyle = '#0c1620';
    g.fillRect(0, 0, 200, 200);
    g.translate(R, R);
    g.rotate(h + Math.PI);
    g.drawImage(this.mapImg, -pu, -pv);

    for (const v of vehicles) {
      const dx = (v.x - px) * S, dy = (v.z - pz) * S;
      if (Math.hypot(dx, dy) < R) {
        g.fillStyle = '#4fb3ff';
        g.beginPath();
        g.arc(dx, dy, 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    for (const mk of marks) {
      let dx = (mk.x - px) * S, dy = (mk.z - pz) * S;
      const r = Math.hypot(dx, dy), k = r > R - 12 ? (R - 12) / r : 1;
      dx *= k; dy *= k;
      g.fillStyle = mk.color;
      g.beginPath();
      g.arc(dx, dy, 5, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    g.save();
    g.translate(R, R);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(6, 6);
    g.lineTo(-6, 6);
    g.closePath();
    g.fill();
    g.restore();

    g.strokeStyle = 'rgba(245,197,66,0.9)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(R, R, R - 2, 0, Math.PI * 2);
    g.stroke();
  },
};
