// vehicles.js — vehicle models, arcade driving physics and spawning

const VEHICLE_TYPES = {
  sedan:  { name: 'Vireo Sedan',   color: 0x2f6fb7, maxSpeed: 34, accel: 13, brake: 26, steer: 0.62, w: 1.9, l: 4.4, h: 1.4 },
  sports: { name: 'Corsa Nova GT', color: 0xd3322b, maxSpeed: 50, accel: 22, brake: 32, steer: 0.5,  w: 2.0, l: 4.6, h: 1.2 },
  hauler: { name: 'Dune Hauler',   color: 0xe0ad32, maxSpeed: 28, accel: 9,  brake: 20, steer: 0.72, w: 2.2, l: 5.0, h: 1.9 },
};

function buildVehicleMesh(type) {
  const t = VEHICLE_TYPES[type], g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: t.color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1b2430 });
  const tyre = new THREE.MeshLambertMaterial({ color: 0x151515 });
  const tail = new THREE.MeshBasicMaterial({ color: 0xff3030 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h * 0.5, t.l), paint);
  body.position.y = 0.55 + t.h * 0.25;
  g.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.85, t.h * 0.5, t.l * 0.5), glass);
  cabin.position.set(0, 0.55 + t.h * 0.75, -t.l * 0.08);
  g.add(cabin);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10), tyre);
      wh.rotation.z = Math.PI / 2;
      wh.position.set(sx * (t.w / 2 + 0.05), 0.36, sz * t.l * 0.32);
      g.add(wh);
    }
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), tail);
    tl.position.set(sx * t.w * 0.36, 0.9, -t.l / 2 - 0.02);
    g.add(tl);
  }
  return g;
}

class Vehicle {
  constructor(scene, type, x, z, h) {
    this.type = type;
    this.t = VEHICLE_TYPES[type];
    this.name = this.t.name;
    this.x = x; this.z = z; this.h = h;
    this.speed = 0;
    this.steer = 0;
    this.mesh = buildVehicleMesh(type);
    scene.add(this.mesh);
    this.sync();
  }

  get y() { return World.heightAt(this.x, this.z) + 0.25; }

  sync() {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.h;
  }

  // ctl: { throttle, reverse, steer (+1 left, -1 right), handbrake }. Returns crash damage.
  update(dt, ctl) {
    const t = this.t;
    this.steer += (ctl.steer * t.steer - this.steer) * Math.min(1, dt * 7);

    let s = this.speed;
    if (ctl.throttle) s = s < -0.5 ? s + t.brake * dt : s + t.accel * dt * Math.max(0.08, 1 - s / t.maxSpeed);
    else if (ctl.reverse) s = s > 0.5 ? s - t.brake * dt : Math.max(s - t.accel * 0.5 * dt, -t.maxSpeed * 0.35);
    else s *= Math.exp(-0.5 * dt);
    if (ctl.handbrake) s *= Math.exp(-3 * dt);
    this.speed = U.clamp(s, -t.maxSpeed * 0.35, t.maxSpeed);

    this.h += (this.speed * Math.tan(this.steer)) / 7 * dt;

    const nx = this.x + Math.sin(this.h) * this.speed * dt;
    const nz = this.z + Math.cos(this.h) * this.speed * dt;
    let dmg = 0;
    if (World.canStand(nx, nz, 1.6)) {
      this.x = nx; this.z = nz;
    } else {
      const hit = Math.abs(this.speed);
      if (World.canStand(nx, this.z, 1.6)) this.x = nx;
      else if (World.canStand(this.x, nz, 1.6)) this.z = nz;
      if (hit > 6) dmg = (hit - 6) * 3;
      this.speed *= -0.25;
    }
    this.sync();
    return dmg;
  }
}

const Vehicles = {
  list: [],
  scene: null,

  spawnAll(scene) {
    this.scene = scene;
    this.list = [];
    const c = CONFIG.CITY;
    // Story vehicles placed where missions need them
    this.add('sedan', -785, 300, 0);
    this.add('hauler', -125, 60, 0);
    this.add('sports', -128, -10, Math.PI);
    this.add('sports', 1090, 520, Math.PI / 2);
    // Parked/roaming cars on the road lanes
    const types = ['sedan', 'sports', 'hauler'];
    for (let n = 0; n < 10; n++) {
      const k = Math.floor(RNG() * (c.nx + 1));
      const side = RNG() < 0.5 ? -1 : 1;
      const z = c.z0 + 40 + RNG() * (c.nz * c.pitch - 80);
      this.add(types[Math.floor(RNG() * 3)], c.x0 + k * c.pitch + side * 4.5, z, RNG() < 0.5 ? 0 : Math.PI);
    }
  },

  add(type, x, z, h) {
    const v = new Vehicle(this.scene, type, x, z, h);
    this.list.push(v);
    return v;
  },

  nearest(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const v of this.list) {
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  },
};
