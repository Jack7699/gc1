// game.js — main controller: renderer, lighting, camera, game loop and state

function makeMarker() {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.35, depthWrite: false })
  );
  beam.position.y = 30;
  g.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4, 5, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.4;
  g.add(ring);
  return g;
}

const Game = {
  state: 'loading',   // loading | menu | playing | paused | dead
  time: 0,
  hour: CONFIG.START_HOUR,
  money: 500,
  xp: 0,
  lastHit: -10,
  wasLocked: false,
  focusX: 0,
  focusZ: 0,
  cam: { yaw: 0, pitch: 0.35, idle: 0 },

  init() {
    const canvas = document.getElementById('game-canvas');
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.skyCol = new THREE.Color(0x8ec9ef);
    this.scene.background = this.skyCol;
    this.scene.fog = new THREE.Fog(0x8ec9ef, 350, 1500);
    this.colors = { day: new THREE.Color(0x8ec9ef), dusk: new THREE.Color(0xe98a5a), night: new THREE.Color(0x070d1f) };
    this.camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.5, 3000);
    this.clock = new THREE.Clock();

    this.hemi = new THREE.HemisphereLight(0xdfeeff, 0x4b5a3a, 0.6);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d0, 1);
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -170, right: 170, top: 170, bottom: -170, near: 1, far: 1000 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun, this.sun.target);
    this.moon = new THREE.DirectionalLight(0x8fa8ff, 0);
    this.scene.add(this.moon, this.moon.target);

    World.build(this.scene);
    Vehicles.spawnAll(this.scene);
    this.player = new Player(this.scene);
    this.marker = makeMarker();
    this.marker.visible = false;
    this.scene.add(this.marker);
    this.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    Input.init(canvas);
    Settings.load();
    UI.init();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.quitToMenu();
    this.loop();
  },

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  },

  applyQuality() {
    const high = Settings.data.quality === 'high';
    this.renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 1.5) : 1);
    this.renderer.shadowMap.enabled = high;
    this.sun.castShadow = high;
    this.scene.fog.near = high ? 350 : 220;
    this.scene.fog.far = high ? 1500 : 900;
    this.camera.far = high ? 3000 : 1600;
    this.camera.updateProjectionMatrix();
  },

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;

    if (this.state === 'menu') {
      this.hour = 17.6;            // golden hour for the cinematic menu
      this.orbitCamera();
    } else {
      if (this.state === 'playing' || this.state === 'dead') {
        this.hour = (this.hour + (dt * 24) / CONFIG.DAY_LENGTH) % 24;
      }
      if (this.state === 'playing') this.updatePlaying(dt);
      this.updateCamera(dt);
    }

    this.updateEnvironment();
    this.renderer.render(this.scene, this.camera);
    Input.endFrame();
  },

  orbitCamera() {
    const a = this.time * 0.04;
    this.focusX = -120; this.focusZ = 0;
    this.camera.position.set(-120 + Math.cos(a) * 820, 150 + Math.sin(this.time * 0.15) * 15, Math.sin(a) * 820);
    this.camera.lookAt(-120, 25, 0);
  },

  updateCamera(dt) {
    const p = this.player;
    const sens = Settings.data.sensitivity, inv = Settings.data.invertY ? -1 : 1;
    const moved = Math.abs(Input.mouseDX) + Math.abs(Input.mouseDY) > 0;
    this.cam.idle = moved ? 0 : this.cam.idle + dt;
    if (Input.locked) {
      this.cam.yaw -= Input.mouseDX * sens;
      this.cam.pitch = U.clamp(this.cam.pitch + Input.mouseDY * sens * inv, -0.25, 1.2);
    }

    let tx, ty, tz, dist;
    if (p.car) {
      const v = p.car;
      // Recentre behind the car when the mouse has been idle
      if (this.cam.idle > 1.2) this.cam.yaw += U.angleDiff(this.cam.yaw, v.h + Math.PI) * Math.min(1, dt * 2.5);
      tx = v.x; ty = v.y + 1.3; tz = v.z;
      dist = 8 + Math.min(4, Math.abs(v.speed) * 0.08);
    } else {
      tx = p.x; ty = p.y + 1.5; tz = p.z;
      dist = 4.8;
    }
    this.focusX = tx; this.focusZ = tz;

    const cp = Math.cos(this.cam.pitch), sp = Math.sin(this.cam.pitch);
    const cx = tx + Math.sin(this.cam.yaw) * cp * dist;
    const cz = tz + Math.cos(this.cam.yaw) * cp * dist;
    const cy = Math.max(ty + sp * dist, World.heightAt(cx, cz) + 0.8);
    this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), 1 - Math.exp(-10 * dt));
    this.camera.lookAt(tx, ty, tz);
  },

  updateEnvironment() {
    const a = ((this.hour - 6) / 24) * Math.PI * 2;
    const elev = Math.sin(a);
    const night = U.clamp(0.5 - elev * 3, 0, 1);
    const fx = this.focusX, fz = this.focusZ;

    this.sun.position.set(fx + Math.cos(a) * 260, elev * 260, fz + 90);
    this.sun.target.position.set(fx, 0, fz);
    this.sun.intensity = U.clamp(elev * 2.2, 0, 1) * 1.05;
    this.moon.position.set(fx - Math.cos(a) * 260, -elev * 260, fz - 90);
    this.moon.target.position.set(fx, 0, fz);
    this.moon.intensity = night * 0.3;
    this.hemi.intensity = 0.3 + (1 - night) * 0.4;

    const dayF = U.clamp(elev * 3 + 0.5, 0, 1);
    this.skyCol.copy(this.colors.night).lerp(this.colors.day, dayF);
    this.skyCol.lerp(this.colors.dusk, U.clamp(1 - Math.abs(elev) * 5, 0, 1) * 0.6);
    this.scene.fog.color.copy(this.skyCol);

    World.updateLights(night);
    World.updateTraffic(this.time);
  },

  updatePlaying(dt) {
    if (Input.pressed('KeyP') || Input.pressed('Escape')) { this.pause(); return; }
    if (Input.pressed('KeyF')) this.toggleVehicle();

    const p = this.player;
    if (p.car) {
      this.driveCar(dt);
    } else {
      const dmg = p.update(dt, this.cam.yaw);
      if (dmg) this.damage(dmg);
      SFX.engine(0, false);
    }
    if (this.state !== 'playing') return;

    if (this.time - this.lastHit > 6 && p.health < 100) p.health = Math.min(100, p.health + dt * 4);

    const events = Missions.update(p);
    if (events) this.handleEvents(events);

    const s = Missions.current();
    this.marker.visible = !!s;
    if (s) this.marker.position.set(s.x, World.heightAt(s.x, s.z), s.z);

    UI.updateHUD({
      health: p.health, money: this.money, xp: this.xp,
      mission: Missions.mission, step: s, stepNum: Missions.stepNumber(),
      stepTotal: Missions.mission ? Missions.mission.steps.length : 0,
      prompt: this.promptText(), car: p.car, speed: p.car ? Math.abs(p.car.speed) * 3.6 : 0,
    });

    if (Settings.data.minimap) {
      const car = p.car;
      const h = car ? car.h : this.cam.yaw + Math.PI;
      const cx = car ? car.x : p.x, cz = car ? car.z : p.z;
      const marks = s ? [{ x: s.x, z: s.z, color: '#ffd23f' }] : [];
      UI.drawMinimap(cx, cz, h, marks, Vehicles.list);
    }
  },

  driveCar(dt) {
    const v = this.player.car;
    const left = Input.down('KeyA') || Input.down('ArrowLeft');
    const right = Input.down('KeyD') || Input.down('ArrowRight');
    const ctl = {
      throttle: Input.down('KeyW') || Input.down('ArrowUp'),
      reverse: Input.down('KeyS') || Input.down('ArrowDown'),
      steer: (left ? 1 : 0) - (right ? 1 : 0),
      handbrake: Input.down('Space'),
    };
    const dmg = v.update(dt, ctl);
    if (dmg > 0) this.damage(dmg);
    SFX.engine(v.speed, true);
    if (Input.pressed('KeyH')) SFX.beep(430, 0.4, 0.18);
  },

  promptText() {
    const p = this.player;
    if (p.car) return 'F — Exit ' + p.car.name;
    const v = Vehicles.nearest(p.x, p.z, 4.5);
    if (v) return 'F — Enter ' + v.name;
    const s = Missions.current();
    if (s && s.kind === 'talk' && Math.hypot(p.x - s.x, p.z - s.z) < 6) return 'E — ' + s.text;
    return '';
  },

  toggleVehicle() {
    const p = this.player;
    if (p.car) { p.exitVehicle(); return; }
    const v = Vehicles.nearest(p.x, p.z, 4.5);
    if (v) {
      p.enterVehicle(v);
      SFX.beep(660, 0.12, 0.15);
    }
  },

  handleEvents(events) {
    for (const ev of events) {
      if (ev.type === 'dialogue') {
        UI.dialogue(ev.name, ev.line);
      } else if (ev.type === 'start') {
        UI.toast('NEW MISSION', `${ev.mission.title} — ${ev.mission.intro}`, '');
      } else if (ev.type === 'complete') {
        this.money += ev.mission.reward;
        this.xp += ev.mission.xp;
        UI.toast('MISSION PASSED', `${ev.mission.title} · +$${ev.mission.reward} · +${ev.mission.xp} XP`, 'good');
        SFX.beep(990, 0.25, 0.2);
        if (ev.last) UI.toast('STORY COMPLETE', 'More to come in GRAND CITY 2.', 'good');
      }
    }
  },

  damage(d) {
    if (this.state !== 'playing') return;
    this.player.health -= d;
    this.lastHit = this.time;
    if (this.player.health <= 0) this.die();
  },

  die() {
    this.state = 'dead';
    this.player.health = 0;
    UI.els.wasted.classList.remove('hidden');
    setTimeout(() => {
      this.money = Math.max(0, this.money - 100);
      this.player.reset(-776, 330);
      this.lastHit = this.time;
      UI.els.wasted.classList.add('hidden');
      this.state = 'playing';
      UI.toast('WASTED', 'Rushed to Mercy General. −$100', 'bad');
    }, 3000);
  },

  // ---- Screens and pointer lock ----

  captureMouse() {
    if (this.state !== 'playing' || Input.locked) return;
    try {
      const pr = this.canvas.requestPointerLock();
      if (pr && pr.catch) pr.catch(() => {});
    } catch (e) { /* ignore */ }
  },

  onLockChange(locked) {
    if (locked) {
      this.wasLocked = true;
      UI.els.hint.classList.add('hidden');
      return;
    }
    if (this.state === 'playing' && this.wasLocked) this.pause();
    if (this.state === 'playing') UI.els.hint.classList.remove('hidden');
  },

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    if (document.pointerLockElement) document.exitPointerLock();
    UI.showScreen('screen-pause');
  },

  resume() {
    this.state = 'playing';
    UI.showScreen(null);
    this.captureMouse();
  },

  startNewGame() {
    SFX.init();
    this.money = 500;
    this.xp = 0;
    this.hour = CONFIG.START_HOUR;
    this.cam.yaw = 0;
    this.cam.pitch = 0.35;
    this.lastHit = this.time;
    Missions.reset();
    this.player.reset(-776, 330);
    this.state = 'playing';
    UI.hud(true);
    UI.showScreen(null);
    UI.toast('NEW MISSION', `${MISSIONS[0].title} — ${MISSIONS[0].intro}`, '');
    this.captureMouse();
  },

  quitToMenu() {
    this.state = 'menu';
    this.player.reset(-776, 330);
    this.marker.visible = false;
    UI.hud(false);
    UI.els.wasted.classList.add('hidden');
    UI.els.hint.classList.add('hidden');
    UI.showScreen('screen-menu');
    if (document.pointerLockElement) document.exitPointerLock();
  },
};

// Start after the loader has painted
setTimeout(() => Game.init(), 60);
