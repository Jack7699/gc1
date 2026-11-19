// missions.js — storyline data and the mission state machine

const MISSIONS = [
  {
    title: 'Harbor Introduction', reward: 1500, xp: 150,
    intro: 'Silas Brenn needs a driver for a marina job. Prove you can be trusted.',
    steps: [
      { kind: 'talk', x: -785, z: 275, npc: 'Silas Brenn', text: 'Speak with Silas Brenn',
        line: 'Good. Take the sedan on Dock Street and meet me at the marina pier.' },
      { kind: 'enter', x: -785, z: 300, text: 'Take the sedan on Dock Street' },
      { kind: 'goto', x: -890, z: -55, r: 14, text: 'Drive to the Marina Pier' },
      { kind: 'talk', x: -890, z: -55, npc: 'Lena Morrow', text: 'Speak with Lena Morrow',
        line: 'Not bad behind the wheel. Silas says you are worth the risk. Next, get the hauler at Garage Seven.' },
    ],
  },
  {
    title: 'Dune Run', reward: 2500, xp: 200,
    intro: 'Lena Morrow has cargo that must reach Eastline Depot before sunrise.',
    steps: [
      { kind: 'goto', x: -120, z: 60, r: 12, text: 'Reach Garage Seven' },
      { kind: 'enter', x: -125, z: 60, text: 'Take the Dune Hauler' },
      { kind: 'goto', x: 650, z: -275, r: 14, text: 'Deliver the cargo to Eastline Depot' },
      { kind: 'talk', x: 650, z: -275, npc: 'Dale Stroud', text: 'Speak with depot foreman Dale Stroud',
        line: 'Cargo received, no questions asked. Victor Hale wants to see you downtown.' },
    ],
  },
  {
    title: 'Coastal Run', reward: 4000, xp: 300,
    intro: 'Victor Hale wants a fast ride along the coast. Three checkpoints. No mistakes.',
    steps: [
      { kind: 'talk', x: -120, z: 165, npc: 'Victor Hale', text: 'Speak with Victor Hale',
        line: 'Three checkpoints along the coast. Keep the car in one piece and the money in your pocket.' },
      { kind: 'enter', x: -128, z: -10, text: 'Take the Corsa Nova GT' },
      { kind: 'goto', x: -560, z: 715, r: 16, text: 'Checkpoint 1: Westshore' },
      { kind: 'goto', x: -230, z: -605, r: 16, text: 'Checkpoint 2: Old Port' },
      { kind: 'goto', x: 430, z: -825, r: 16, text: 'Checkpoint 3: Northline Pier' },
    ],
  },
  {
    title: 'Ridge Overlook', reward: 6000, xp: 400,
    intro: 'The final meet is above the city. Victor Hale is waiting on the ridge.',
    steps: [
      { kind: 'enter', x: 1090, z: 520, text: 'Take the Corsa Nova GT in the hills' },
      { kind: 'goto', x: 1180, z: 560, r: 20, text: 'Climb to Ridge Overlook' },
      { kind: 'talk', x: 1180, z: 560, npc: 'Victor Hale', text: 'Speak with Victor Hale',
        line: 'Grand City was only the beginning. Welcome to the family.' },
    ],
  },
];

const Missions = {
  index: 0,
  step: 0,

  get mission() { return MISSIONS[this.index] || null; },

  current() {
    const m = this.mission;
    return m ? m.steps[this.step] : null;
  },

  stepNumber() { return this.step + 1; },

  reset() { this.index = 0; this.step = 0; },

  // Returns an array of events when a step completes, otherwise null
  update(player) {
    const s = this.current();
    if (!s) return null;
    const d = Math.hypot(player.x - s.x, player.z - s.z);
    let done = false;
    if (s.kind === 'enter') done = !!player.car;
    else if (s.kind === 'goto') done = d < s.r;
    else if (s.kind === 'talk') done = d < 6 && Input.pressed('KeyE');
    return done ? this.advance(s) : null;
  },

  advance(s) {
    const events = [];
    const m = this.mission;
    if (s.kind === 'talk') events.push({ type: 'dialogue', name: s.npc, line: s.line });
    this.step++;
    if (this.step >= m.steps.length) {
      this.index++;
      this.step = 0;
      const next = this.mission;
      events.push({ type: 'complete', mission: m, last: !next });
      if (next) events.push({ type: 'start', mission: next });
    }
    return events;
  },
};
