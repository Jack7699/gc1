// player.js — on-foot character: movement, jumping, collision and vehicle entry/exit

function buildCharacter() {
  const g = new THREE.Group();
  const m = (c) => new THREE.MeshLambertMaterial({ color: c });
  const jacket = m(0x2b3d55), jeans = m(0x1d2633), skin = m(0xc98f63), hair = m(0x1a1410);
  const add = (geo, mat, x, y, z, parent = g) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  add(new THREE.BoxGeometry(0.6, 0.75, 0.36), jacket, 0, 1.35, 0);
  add(new THREE.BoxGeometry(0.32, 0.34, 0.32), skin, 0, 1.9, 0);
  add(new THREE.BoxGeometry(0.34, 0.1, 0.34), hair, 0, 2.1, 0);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.16, 0.85, 0);
    add(new THREE.BoxGeometry(0.24, 0.85, 0.26), jeans, 0, -0.42, 0, leg);
    g.add(leg);
    legs.push(leg);
    const arm = new THREE.Group();
    arm.position.set(s * 0.42, 1.65, 0);
    add(new THREE.BoxGeometry(0.2, 0.7, 0.2), jacket, 0, -0.35, 0, arm);
    g.add(arm);
    arms.push(arm);
  }
  g.userData = { legs, arms };
  return g;
}

class Player {
  constructor(scene) {
    this.mesh = buildCharacter();
    scene.add(this.mesh);
    this.legs = this.mesh.userData.legs;
    this.arms = this.mesh.userData.arms;
    this.phase = 0;
    this.reset(-776, 330);
  }

  reset(x, z) {
    Object.assign(this, {
      x, z,
      y: World.heightAt(x, z) + 0.18,
      vx: 0, vz: 0, vy: 0,
      rot: 0, car: null, onGround: true, health: 100,
    });
    this.mesh.visible = true;
  }

  // yaw = camera yaw; returns fall damage taken this frame
  update(dt, yaw) {
    if (this.car) return 0;
    const f = (Input.down('KeyW') ? 1 : 0) - (Input.down('KeyS') ? 1 : 0);
    const r = (Input.down('KeyD') ? 1 : 0) - (Input.down('KeyA') ? 1 : 0);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    // camera forward is (-sin, -cos); camera right is (cos, -sin)
    let mx = -sy * f + cy * r, mz = -cy * f - sy * r;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }
    const sprint = Input.down('ShiftLeft') || Input.down('ShiftRight');
    const speed = len > 0 ? (sprint ? 10 : 5.6) : 0;
    this.vx += (mx * speed - this.vx) * Math.min(1, dt * 10);
    this.vz += (mz * speed - this.vz) * Math.min(1, dt * 10);
    if (Math.hypot(this.vx, this.vz) > 0.3) this.rot = Math.atan2(this.vx, this.vz);

    if (Input.pressed('Space') && this.onGround) { this.vy = 8.5; this.onGround = false; }
    this.vy -= 24 * dt;

    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    if (!World.canStand(nx, this.z, 0.4)) nx = this.x;
    if (!World.canStand(nx, nz, 0.4)) nz = this.z;
    this.x = nx; this.z = nz;
    this.y += this.vy * dt;

    let dmg = 0;
    const ground = World.heightAt(this.x, this.z) + 0.18;
    if (this.y <= ground) {
      if (this.vy < -15) dmg = (-this.vy - 15) * 4;
      this.y = ground; this.vy = 0; this.onGround = true;
    }

    // Animation: swing legs and arms while moving
    const sp = Math.hypot(this.vx, this.vz);
    this.phase += sp * dt * 1.4;
    const swing = this.onGround ? Math.sin(this.phase) * Math.min(1, sp / 5) * 0.7 : 0.3;
    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    this.arms[0].rotation.x = -swing * 0.7;
    this.arms[1].rotation.x = swing * 0.7;

    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.rot;
    return dmg;
  }

  enterVehicle(v) {
    this.car = v;
    this.mesh.visible = false;
  }

  exitVehicle() {
    const v = this.car;
    if (!v) return;
    const lx = -Math.cos(v.h), lz = Math.sin(v.h); // vehicle's left side
    let spot = null;
    for (const s of [1, -1]) {
      const x = v.x + lx * 2.2 * s, z = v.z + lz * 2.2 * s;
      if (World.canStand(x, z, 0.4)) { spot = [x, z]; break; }
    }
    if (!spot) spot = [v.x, v.z + 3];
    this.x = spot[0];
    this.z = spot[1];
    this.y = World.heightAt(this.x, this.z) + 0.18;
    this.vx = this.vz = this.vy = 0;
    this.car = null;
    this.mesh.visible = true;
  }
}
