// ============================================================
// ToCX JAM — 1-on-1 robot basketball (Mega Man x NBA Jam style)
// ============================================================

(() => {
'use strict';

// ---------- canvas ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let CW = 0, CH = 0, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  CW = window.innerWidth; CH = window.innerHeight;
  canvas.width = Math.round(CW * DPR);
  canvas.height = Math.round(CH * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ---------- world constants ----------
const WORLD = { w: 1250, h: 520, floor: 440 };
const G = 2400;               // gravity px/s^2
const BALL_R = 11;
const PLAYER_H = 120;
const PLAYER_W = 38;
const RIM_HALF = 30;          // rim half width
const RIM_Y = 235;
const THREE_DIST = 380;
const GAME_LEN = 90;          // seconds

const HOOPS = {
  left:  { x: 88,            rimY: RIM_Y, dir: 1  },  // faces right
  right: { x: WORLD.w - 88,  rimY: RIM_Y, dir: -1 },  // faces left
};
// backboard x for each hoop (behind the rim)
HOOPS.left.boardX = HOOPS.left.x - RIM_HALF - 6;
HOOPS.right.boardX = HOOPS.right.x + RIM_HALF + 6;

// ---------- audio ----------
const AudioSys = {
  ctx: null,
  init() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(f, dur, type = 'square', vol = 0.06, slideTo = 0, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.03);
  },
  noise(dur, vol = 0.08, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(this.ctx.destination);
    src.start(t);
  },
};

function sfx(name) {
  const A = AudioSys;
  switch (name) {
    case 'bounce': A.tone(110, 0.07, 'sine', 0.1, 70); break;
    case 'shoot': A.noise(0.12, 0.04); A.tone(500, 0.12, 'sine', 0.03, 900); break;
    case 'swish': A.noise(0.18, 0.07); A.tone(880, 0.1, 'sine', 0.05, 1400, 0.05); break;
    case 'rim': A.tone(220, 0.12, 'triangle', 0.1, 160); break;
    case 'board': A.tone(160, 0.1, 'square', 0.06, 120); break;
    case 'slam': A.noise(0.25, 0.14); A.tone(90, 0.3, 'sawtooth', 0.12, 40); break;
    case 'buzzer': A.tone(85, 0.9, 'sawtooth', 0.12); A.tone(87, 0.9, 'square', 0.06); break;
    case 'whistle': A.tone(2100, 0.25, 'square', 0.04, 1900); break;
    case 'hit': A.noise(0.1, 0.1); A.tone(150, 0.18, 'sawtooth', 0.1, 60); break;
    case 'steal': A.tone(700, 0.08, 'square', 0.06, 1100); break;
    case 'power': A.tone(300, 0.15, 'sawtooth', 0.06, 700); break;
    case 'fire': [440, 554, 659, 880].forEach((f, i) => A.tone(f, 0.12, 'square', 0.06, 0, i * 0.08)); break;
    case 'score2': [523, 659].forEach((f, i) => A.tone(f, 0.12, 'square', 0.06, 0, i * 0.09)); break;
    case 'score3': [523, 659, 784, 1046].forEach((f, i) => A.tone(f, 0.11, 'square', 0.06, 0, i * 0.08)); break;
    case 'select': A.tone(600, 0.08, 'square', 0.05, 900); break;
    case 'go': [392, 523, 659, 784].forEach((f, i) => A.tone(f, 0.12, 'triangle', 0.07, 0, i * 0.1)); break;
  }
}

// ---------- input ----------
const input = { left: false, right: false, jump: false, shoot: false, power: false };
const prevInput = { ...input };
const keys = {};
let taps = [];            // screen-space taps for menus
let buttons = [];         // active touch buttons: {id, x, y, r, label}
const touchMap = new Map(); // touchId -> buttonId

window.addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight','ArrowUp','Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function buttonAt(x, y) {
  for (const b of buttons) {
    const dx = x - b.x, dy = y - b.y;
    if (dx * dx + dy * dy <= b.r * b.r * 1.45) return b.id; // generous hit area
  }
  return null;
}

// Pointer events give one unified path for touch + mouse (no double-fired taps).
canvas.addEventListener('pointerdown', e => {
  AudioSys.init();
  const b = buttonAt(e.clientX, e.clientY);
  touchMap.set(e.pointerId, b);
  if (!b) taps.push({ x: e.clientX, y: e.clientY });
  e.preventDefault();
});
canvas.addEventListener('pointermove', e => {
  if (!touchMap.has(e.pointerId)) return;
  touchMap.set(e.pointerId, buttonAt(e.clientX, e.clientY));
});
// listen on window so a finger sliding off the canvas never leaves a button stuck
const endPointer = e => { touchMap.delete(e.pointerId); };
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);
window.addEventListener('blur', () => touchMap.clear());
// stop iOS from also synthesizing scrolls/clicks
canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });

function pollInput() {
  Object.assign(prevInput, input);
  const pressed = new Set();
  for (const b of touchMap.values()) if (b) pressed.add(b);
  input.left = pressed.has('left') || !!keys['ArrowLeft'];
  input.right = pressed.has('right') || !!keys['ArrowRight'];
  input.jump = pressed.has('jump') || !!keys['ArrowUp'] || !!keys['KeyZ'];
  input.shoot = pressed.has('shoot') || !!keys['KeyX'] || !!keys['Space'];
  input.power = pressed.has('power') || !!keys['KeyC'];
}
const pressedNow = k => input[k] && !prevInput[k];
const releasedNow = k => !input[k] && prevInput[k];

// ---------- game state ----------
let state = 'title';   // title | select | game | over
let selectPhase = 0;   // 0 = pick player, 1 = pick opponent
let selP1 = null, selP2 = null;
let players = [];      // [p1, ai]
let ball = null;
let projectiles = [];
let particles = [];
let banners = [];
let clock = GAME_LEN;
let suddenDeath = false;
let freezeT = 0;       // freeze after scores
let pendingInbound = null; // { to, hoop } applied when the freeze ends
let shake = 0;
let camX = 0;
let winner = null;
let tipT = 0;

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function makePlayer(ch, isAI, attackHoop) {
  return {
    ch, isAI, attackHoop,                    // 'left' | 'right'
    x: 0, y: WORLD.floor, vx: 0, vy: 0,
    facing: attackHoop === 'right' ? 1 : -1,
    onGround: true, hasBall: false,
    shooting: false, shootRaise: 0, shootHeld: false,
    dunk: null,                              // {t, dur, sx, sy, tx, ty}
    stunT: 0, hitImmuneT: 0,
    cd: 0, stealCd: 0, pickupCd: 0, swipeT: 0,
    score: 0, streak: 0, onFire: false,
    runPhase: 0,
    aiThink: 0, aiMoveTarget: null, aiWantJump: false,
  };
}

function hoopOf(p) { return HOOPS[p.attackHoop]; }
function ownHoopOf(p) { return HOOPS[p.attackHoop === 'right' ? 'left' : 'right']; }
function opp(p) { return players[0] === p ? players[1] : players[0]; }

function effSpeed(p) {
  let s = p.ch.stats.speed;
  if (p.onFire) s += 40;
  if (p.ch.id === 'hurt' && p.score < opp(p).score) s += 45; // pain boost
  return s;
}

function startGame(ch1, ch2) {
  players = [makePlayer(ch1, false, 'right'), makePlayer(ch2, true, 'left')];
  projectiles = []; particles = []; banners = [];
  clock = GAME_LEN; suddenDeath = false; freezeT = 0; winner = null;
  pendingInbound = null;
  players[0].x = WORLD.w / 2 - 130;
  players[1].x = WORLD.w / 2 + 130;
  ball = { x: WORLD.w / 2, y: WORLD.floor - 320, vx: 0, vy: -150, heldBy: null, shot: null, fire: false, bounceCd: 0 };
  tipT = 0.8;
  camX = WORLD.w / 2;
  state = 'game';
  banner('TIP OFF!', '#ffd94a');
  sfx('whistle');
}

function banner(text, color = '#fff', sub = null, dur = 1.4, delay = 0) {
  banners.push({ text, color, sub, t: dur, dur, delay });
}

// ---------- scoring ----------
function scoreBasket(shooter, points, dunked) {
  shooter.score += points;
  const other = opp(shooter);
  shooter.streak++;
  other.streak = 0;
  if (other.onFire) { other.onFire = false; }
  if (shooter.streak === 3 && !shooter.onFire) {
    shooter.onFire = true;
    banner(`${shooter.ch.name} IS ON FIRE!`, '#ff5722', null, 1.8, 0.5);
    sfx('fire');
  }
  if (dunked) {
    banner(pick(['BOOMSHAKALAKA!', 'SLAM!', 'WITH AUTHORITY!', 'JAM IT IN!']), '#ff8c3a', `${shooter.ch.name} +${points}`);
    sfx('slam');
  } else if (points === 3) {
    banner(pick(['FROM DOWNTOWN!', 'SPLASH!', 'FOR THREE!']), '#6ee7ff', `${shooter.ch.name} +3`);
    sfx('score3');
  } else {
    banner(pick(['BUCKETS!', 'COUNT IT!', 'NICE SHOT!']), '#9dff6e', `${shooter.ch.name} +2`);
    sfx('score2');
  }
  const hp = hoopOf(shooter);
  confetti(hp.x, hp.rimY, points === 3 ? 26 : 16);

  if (suddenDeath) { endGame(shooter); return; }
  freezeT = 1.25;
  pendingInbound = { to: other, from: shooter, hoop: hp };
}

function applyInbound() {
  const { to, from, hoop } = pendingInbound;
  pendingInbound = null;
  ball.heldBy = to; to.hasBall = true;
  ball.shot = null; ball.fire = to.onFire;
  to.x = clamp(hoop.x + hoop.dir * 110, 60, WORLD.w - 60);
  to.y = WORLD.floor; to.vy = 0; to.vx = 0; to.stunT = 0;
  to.shooting = false; to.shootHeld = false;
  to.facing = to.attackHoop === 'right' ? 1 : -1;
  // the scorer retreats to their own defensive half and can't
  // immediately mug the inbounder (NBA-Jam-style grace period)
  const fromHoop = ownHoopOf(from);
  from.x = clamp(WORLD.w / 2 + (fromHoop.x < WORLD.w / 2 ? -150 : 150), 60, WORLD.w - 60);
  from.y = WORLD.floor; from.vy = 0; from.vx = 0;
  from.stealCd = Math.max(from.stealCd, 1.3);
  from.cd = Math.max(from.cd, 1.3);
  to.hitImmuneT = Math.max(to.hitImmuneT, 1.0);
}

function endGame(w) {
  winner = w;
  state = 'over';
  sfx('buzzer');
}

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ---------- shooting ----------
function shotAccuracy(p, dist) {
  const st = p.ch.stats;
  let acc;
  if (dist < 110) acc = 0.85;
  else if (dist < 260) acc = lerp(0.85, st.mid, (dist - 110) / 150);
  else if (dist < THREE_DIST + 40) acc = lerp(st.mid, st.three, (dist - 260) / (THREE_DIST + 40 - 260));
  else acc = st.three * Math.pow((THREE_DIST + 40) / dist, 2.2);

  // timing: best near apex
  if (!p.onGround && Math.abs(p.vy) < 160) acc += 0.10;
  else if (p.onGround) acc -= 0.15;

  // defender pressure
  const d = opp(p);
  const dd = Math.hypot(d.x - p.x, d.y - p.y);
  if (dd < 70) acc -= 0.18;
  if (dd < 110 && !d.onGround) acc -= 0.22;

  if (p.onFire) acc += 0.13;
  if (p.ch.id === 'hurt' && p.score < opp(p).score) acc += 0.07;
  if (p.isAI) acc *= 0.8; // CPU shoots like a robot, not a god
  return clamp(acc, 0.03, 0.97);
}

function releaseShot(p) {
  if (!p.hasBall) return;
  const hp = hoopOf(p);
  const relX = p.x + p.facing * 6;
  const relY = p.y - PLAYER_H - 14;
  const dist = Math.abs(relX - hp.x);
  const acc = shotAccuracy(p, dist);
  const make = Math.random() < acc;
  const points = dist > THREE_DIST ? 3 : 2;

  let tx = hp.x, ty = hp.rimY - 3;
  if (!make) {
    const off = (Math.random() < 0.5 ? -1 : 1) * rnd(18, 42);
    tx += off; ty += rnd(-6, 4);
  }
  const T = 0.75 + dist / 950;
  ball.heldBy = null; p.hasBall = false;
  ball.x = relX; ball.y = relY;
  ball.vx = (tx - relX) / T;
  ball.vy = (ty - relY - 0.5 * G * T * T) / T;
  ball.shot = { shooter: p, willMake: make, points, hoop: hp };
  ball.fire = p.onFire;
  p.shooting = false; p.shootHeld = false;
  p.pickupCd = 0.5;
  sfx('shoot');
}

function startDunk(p) {
  const hp = hoopOf(p);
  p.dunk = {
    t: 0,
    dur: clamp(Math.abs(p.x - hp.x) / 420 + 0.32, 0.4, 0.7),
    sx: p.x, sy: p.y,
    tx: hp.x - hp.dir * 2,
    ty: hp.rimY + 62,       // feet position so raised hands reach the rim
  };
  p.onGround = false;
  p.facing = p.x < hp.x ? 1 : -1; // face the hoop
}

function tryShootPress(p) {
  const hp = hoopOf(p);
  const dist = Math.abs(p.x - hp.x);
  const towardHoop = (hp.x - p.x) * p.facing >= 0 || dist < 90;
  let range = p.ch.stats.dunk * (p.onFire ? 1.25 : 1);
  if (dist < range && towardHoop) { startDunk(p); return; }
  // jump shot
  p.shooting = true; p.shootHeld = true;
  if (p.onGround) { p.vy = -p.ch.stats.jump * 0.88; p.onGround = false; }
}

// ---------- powers ----------
function firePower(p) {
  if (p.cd > 0 || p.hasBall || p.stunT > 0 || p.dunk) return;
  const t = p.ch.power.type;
  const dir = opp(p).x >= p.x ? 1 : -1;
  p.facing = dir;
  const px = p.x + dir * 22, py = p.y - PLAYER_H * 0.62;
  const mk = o => projectiles.push(Object.assign({
    owner: p, type: t, x: px, y: py, vx: 0, vy: 0, r: 10, life: 2.2,
    grav: 0, bounces: 0, dead: false, age: 0,
  }, o));

  switch (t) {
    case 'cosmic':   mk({ vx: dir * 430, vy: -260, grav: G * 0.75, r: 11, bounces: 2, life: 2.6 }); break;
    case 'medisphere': mk({ vx: dir * 330, vy: -540, grav: G * 0.9, r: 10, life: 3 }); break;
    case 'nails':
      for (const vy of [-90, 0, 90]) mk({ vx: dir * 580, vy, grav: 280, r: 6, life: 1.2 });
      break;
    case 'screw':    mk({ vx: dir * 500, vy: -150, grav: G, r: 8, bounces: 6, life: 2.0 }); break;
    case 'saw':      mk({ vx: dir * 520, vy: 0, r: 15, life: 1.7 }); break;
    case 'sonic':    mk({ vx: dir * 400, vy: 0, r: 10, life: 2.2 }); break;
    case 'lockball': mk({ vx: dir * 310, vy: -120, grav: 300, r: 13, life: 2.4 }); break;
  }
  p.cd = p.ch.stats.cd * (p.onFire ? 0.6 : 1);
  sfx('power');
}

function hitPlayer(victim, proj) {
  if (victim.hitImmuneT > 0) return;
  let stun = 0.95;
  if (proj.type === 'lockball') stun = 1.7;
  if (victim.ch.id === 'nail') stun *= 0.5; // hardened
  victim.stunT = stun;
  victim.hitImmuneT = stun + 0.8;
  const kb = proj.type === 'saw' ? 320 : 150;
  victim.vx = Math.sign(proj.vx || (victim.x - proj.x)) * kb;
  victim.vy = Math.min(victim.vy, -180);
  victim.onGround = false;
  victim.shooting = false; victim.shootHeld = false;

  if (victim.dunk) victim.dunk = null;
  if (victim.hasBall) {
    // strip resist for Old Man
    if (victim.ch.id === 'old' && Math.random() < 0.3) {
      // holds on!
    } else {
      fumble(victim);
    }
  }
  sfx('hit');
  burst(victim.x, victim.y - PLAYER_H / 2, '#ffd94a', 10);
  shake = Math.max(shake, 6);
}

function fumble(victim) {
  victim.hasBall = false;
  ball.heldBy = null; ball.shot = null; ball.fire = false;
  ball.x = victim.x; ball.y = victim.y - PLAYER_H - 6;
  ball.vx = rnd(-140, 140); ball.vy = -380;
  victim.pickupCd = 0.7;
}

function trySteal(p) {
  if (p.stealCd > 0) return;
  p.stealCd = 0.8; p.swipeT = 0.22;
  const o = opp(p);
  if (!o.hasBall || o.dunk) return;
  const d = Math.hypot(o.x - p.x, (o.y - PLAYER_H / 2) - (p.y - PLAYER_H / 2));
  if (d > 76) return;
  let chance = p.ch.stats.steal;
  if (o.ch.id === 'old') chance -= 0.12; // sure hands
  if (o.stunT > 0) chance = 1;
  if (Math.random() < chance) {
    fumble(o);
    ball.vx = (p.x - o.x) * 3;
    p.pickupCd = 0;
    sfx('steal');
    if (Math.random() < 0.4) banner('THE STEAL!', '#6ee7ff', null, 0.9);
  }
}

// ---------- particles ----------
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), s = rnd(60, 260);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: rnd(0.3, 0.6), color, r: rnd(2, 4) });
  }
}
function confetti(x, y, n) {
  const colors = ['#ff5722', '#ffd94a', '#6ee7ff', '#9dff6e', '#c792ff'];
  for (let i = 0; i < n; i++) {
    particles.push({ x: x + rnd(-30, 30), y, vx: rnd(-120, 120), vy: rnd(-260, -60), life: rnd(0.5, 1), color: pick(colors), r: rnd(2, 4) });
  }
}

// ---------- player update ----------
function updatePlayer(p, dt) {
  const st = p.ch.stats;

  if (p.cd > 0) p.cd -= dt;
  if (p.stealCd > 0) p.stealCd -= dt;
  if (p.pickupCd > 0) p.pickupCd -= dt;
  if (p.hitImmuneT > 0) p.hitImmuneT -= dt;
  if (p.swipeT > 0) p.swipeT -= dt;

  // dunk animation overrides physics
  if (p.dunk) {
    const d = p.dunk;
    d.t += dt;
    const t = Math.min(1, d.t / d.dur);
    const e = t * t * (3 - 2 * t);
    p.x = lerp(d.sx, d.tx, e);
    p.y = lerp(d.sy, d.ty, e) - Math.sin(t * Math.PI) * 60;
    p.shootRaise = Math.min(1, t * 2);
    if (t >= 1) {
      // SLAM
      const hp = hoopOf(p);
      p.dunk = null;
      p.vy = 60; p.vx = -hp.dir * 60;
      ball.heldBy = null; p.hasBall = false;
      ball.x = hp.x; ball.y = hp.rimY + 4; ball.vx = 0; ball.vy = 420;
      ball.shot = null; ball.fire = false;
      p.pickupCd = 0.8;
      shake = Math.max(shake, 10);
      scoreBasket(p, 2, true);
    }
    return;
  }

  const stunned = p.stunT > 0;
  if (stunned) p.stunT -= dt;

  // ---- movement intent ----
  let mv = 0;
  if (!stunned) {
    if (p.isAI) {
      mv = aiMove(p);
    } else {
      if (input.left) mv -= 1;
      if (input.right) mv += 1;
    }
  }
  const spd = effSpeed(p);
  const accel = p.onGround ? 2600 : 1400;
  if (mv !== 0) {
    p.vx = clamp(p.vx + mv * accel * dt, -spd, spd);
    p.facing = mv > 0 ? 1 : -1;
  } else {
    const f = p.onGround ? 2200 : 300;
    if (p.vx > 0) p.vx = Math.max(0, p.vx - f * dt);
    else p.vx = Math.min(0, p.vx + f * dt);
  }

  // ---- actions ----
  if (!stunned && !p.isAI) {
    if (pressedNow('jump') && p.onGround && !p.shooting) {
      p.vy = -st.jump; p.onGround = false;
    }
    if (pressedNow('shoot')) {
      if (p.hasBall) tryShootPress(p);
      else trySteal(p);
    }
    if (releasedNow('shoot') && p.shootHeld && p.hasBall) releaseShot(p);
    if (pressedNow('power')) firePower(p);
  }
  if (!stunned && p.isAI) aiActions(p, dt);

  // auto-release if landing with the ball still raised
  // (handled after physics below)

  // ---- physics ----
  p.vy += G * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = clamp(p.x, 26, WORLD.w - 26);
  if (p.y >= WORLD.floor) {
    const wasAir = !p.onGround;
    p.y = WORLD.floor; p.vy = 0; p.onGround = true;
    if (wasAir && p.shootHeld && p.hasBall) releaseShot(p);
  }

  // run animation phase
  if (p.onGround && Math.abs(p.vx) > 30) p.runPhase = (p.runPhase + dt * (Math.abs(p.vx) / 26)) % 1;
  else p.runPhase = 0;

  // shoot arm raise animation
  const targetRaise = (p.shooting || p.swipeT > 0) ? 1 : 0;
  p.shootRaise = clamp(p.shootRaise + (targetRaise - p.shootRaise) * dt * 14, 0, 1);
}

// ---------- AI ----------
function aiMove(p) {
  const o = opp(p);
  let target = p.aiMoveTarget;
  if (target == null) return 0;
  const dx = target - p.x;
  if (Math.abs(dx) < 14) return 0;
  return dx > 0 ? 1 : -1;
}

function aiActions(p, dt) {
  const o = opp(p);
  const hp = hoopOf(p);
  p.aiThink -= dt;

  // continue a started jump shot: release near apex
  if (p.shootHeld && p.hasBall && !p.onGround && p.vy > -120) {
    releaseShot(p);
    return;
  }

  if (p.aiThink > 0) return;
  p.aiThink = 0.18;

  const dist = Math.abs(p.x - hp.x);
  const dDef = Math.hypot(o.x - p.x, o.y - p.y);
  const prefersThree = p.ch.stats.three >= 0.42;

  if (p.hasBall) {
    // pick a spot
    if (prefersThree && dist > 200 && Math.random() < 0.65) {
      p.aiMoveTarget = hp.x + (p.attackHoop === 'right' ? -1 : 1) * rnd(THREE_DIST + 15, THREE_DIST + 55);
    } else {
      p.aiMoveTarget = hp.x + (p.attackHoop === 'right' ? -1 : 1) * rnd(20, 60);
    }
    const range = p.ch.stats.dunk * (p.onFire ? 1.25 : 1);
    if (dist < range && p.onGround && Math.random() < 0.35) { startDunk(p); return; }
    const open = dDef > 95;
    const inRange = dist < (prefersThree ? THREE_DIST + 70 : 320);
    const shootP = open ? 0.22 : 0.05;
    if (inRange && p.onGround && Math.random() < shootP) {
      p.shooting = true; p.shootHeld = true;
      p.vy = -p.ch.stats.jump * 0.88; p.onGround = false;
    }
  } else if (o.hasBall) {
    // defend: sit between carrier and the hoop they attack (our defended hoop)
    const theirHoop = hoopOf(o);
    const side = theirHoop.x > o.x ? 1 : -1;
    p.aiMoveTarget = o.x + side * rnd(70, 130);
    // steal if close
    if (dDef < 72 && Math.random() < 0.15) trySteal(p);
    // fire power if lined up
    if (p.cd <= 0 && dDef > 110 && dDef < 520 && Math.abs(o.y - p.y) < 80 && Math.random() < 0.3) {
      firePower(p);
    }
    // jump to contest if carrier is shooting nearby
    if (o.shooting && dDef < 130 && p.onGround && Math.random() < 0.5) {
      p.vy = -p.ch.stats.jump; p.onGround = false;
    }
  } else {
    // loose ball
    p.aiMoveTarget = ball.x;
    if (ball.y < p.y - 120 && Math.abs(ball.x - p.x) < 50 && p.onGround && Math.random() < 0.4) {
      p.vy = -p.ch.stats.jump; p.onGround = false;
    }
  }
}

// ---------- ball ----------
function updateBall(dt) {
  if (ball.bounceCd > 0) ball.bounceCd -= dt;

  if (ball.heldBy) {
    const p = ball.heldBy;
    const off = ballHoldOffset(PLAYER_H, p.facing, p.shootRaise);
    // dribble bob when running on ground
    let bob = 0;
    if (p.onGround && Math.abs(p.vx) > 30 && p.shootRaise < 0.1) {
      bob = Math.abs(Math.sin(performance.now() / 90)) * 34;
      if (bob > 28 && ball.bounceCd <= 0) { sfx('bounce'); ball.bounceCd = 0.25; }
    }
    ball.x = p.x + off.x;
    ball.y = p.y + off.y + bob;
    ball.vx = p.vx; ball.vy = 0;
    ball.fire = p.onFire;
    return;
  }

  ball.vy += G * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  const sh = ball.shot;

  // made basket detection
  if (sh && sh.willMake && ball.vy > 0 && ball.y >= sh.hoop.rimY && ball.y < sh.hoop.rimY + 40 && Math.abs(ball.x - sh.hoop.x) < 16) {
    sfx('swish');
    const shooter = sh.shooter;
    const pts = sh.points;
    ball.shot = null;
    ball.vx *= 0.2; ball.vy = 200;
    scoreBasket(shooter, pts, false);
  }

  // block / goaltend: a defender touching a live shot swats it away —
  // goaltending is 100% legal in ToCX JAM (works on the way down too)
  if (ball.shot) {
    for (const p of players) {
      if (p === ball.shot.shooter) continue;
      const reach = PLAYER_W / 2 + BALL_R + (p.onGround ? 4 : 12);
      if (Math.abs(ball.x - p.x) < reach && ball.y > p.y - PLAYER_H - 32 && ball.y < p.y) {
        const goaltend = ball.vy > 0;
        ball.shot = null;
        ball.vx = (ball.x - p.x) * 8 + p.vx;
        ball.vy = rnd(-160, 40);
        sfx('rim');
        banner(goaltend ? pick(['GOALTENDING? ALLOWED!', 'SWATTED!', 'NOT TODAY!'])
                        : pick(['REJECTED!', 'DENIED!', 'GET OUTTA HERE!']), '#ff5c5c', null, 1);
        burst(ball.x, ball.y, '#ffffff', 8);
        break;
      }
    }
  }

  // shot becomes a live rebound once it drops past the rim plane
  if (ball.shot && ball.vy > 0 && ball.y > ball.shot.hoop.rimY + 50) ball.shot = null;

  // rim + backboard collisions (skip while a made shot is in flight)
  for (const key of ['left', 'right']) {
    const hp = HOOPS[key];
    if (ball.shot && ball.shot.willMake && ball.shot.hoop === hp) continue;
    // rim tips
    for (const rx of [hp.x - RIM_HALF, hp.x + RIM_HALF]) {
      const dx = ball.x - rx, dy = ball.y - hp.rimY;
      const dd = Math.hypot(dx, dy);
      if (dd < BALL_R + 4 && dd > 0.01) {
        const nx = dx / dd, ny = dy / dd;
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          ball.vx -= 2 * dot * nx; ball.vy -= 2 * dot * ny;
          ball.vx *= 0.55; ball.vy *= 0.55;
          ball.x = rx + nx * (BALL_R + 4.5); ball.y = hp.rimY + ny * (BALL_R + 4.5);
          ball.shot = null;
          sfx('rim');
        }
      }
    }
    // backboard
    const bx = hp.boardX;
    if (ball.y > hp.rimY - 78 && ball.y < hp.rimY + 12) {
      if ((key === 'left' && ball.x < bx + BALL_R && ball.vx < 0) ||
          (key === 'right' && ball.x > bx - BALL_R && ball.vx > 0)) {
        ball.vx *= -0.55;
        ball.x = key === 'left' ? bx + BALL_R : bx - BALL_R;
        ball.shot = null;
        sfx('board');
      }
    }
  }

  // floor
  if (ball.y > WORLD.floor - BALL_R) {
    ball.y = WORLD.floor - BALL_R;
    if (Math.abs(ball.vy) > 60) { sfx('bounce'); }
    ball.vy *= -0.62;
    ball.vx *= 0.86;
    ball.shot = null;
    ball.fire = false;
    if (Math.abs(ball.vy) < 40) ball.vy = 0;
  }
  // walls
  if (ball.x < BALL_R + 8) { ball.x = BALL_R + 8; ball.vx *= -0.7; }
  if (ball.x > WORLD.w - BALL_R - 8) { ball.x = WORLD.w - BALL_R - 8; ball.vx *= -0.7; }

  // pickup
  if (!ball.heldBy && !ball.shot) {
    for (const p of players) {
      if (p.pickupCd > 0 || p.stunT > 0 || p.dunk) continue;
      if (Math.abs(ball.x - p.x) < 44 && ball.y > p.y - PLAYER_H - 26 && ball.y < p.y + 8) {
        ball.heldBy = p; p.hasBall = true;
        p.shooting = false; p.shootHeld = false;
        ball.fire = p.onFire;
        break;
      }
    }
  }
}

// ---------- projectiles ----------
function updateProjectiles(dt) {
  const t = performance.now() / 1000;
  for (const pr of projectiles) {
    pr.age += dt;
    pr.life -= dt;
    if (pr.life <= 0) { pr.dead = true; continue; }

    if (pr.type === 'sonic') {
      // homing
      const target = opp(pr.owner);
      const ty = target.y - PLAYER_H / 2;
      const ang = Math.atan2(ty - pr.y, target.x - pr.x);
      const cur = Math.atan2(pr.vy, pr.vx);
      let diff = ang - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const na = cur + clamp(diff, -2.2 * dt, 2.2 * dt);
      const sp = 400;
      pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
    }

    pr.vy += (pr.grav || 0) * dt;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;

    // floor
    if (pr.y > WORLD.floor - pr.r) {
      if (pr.type === 'medisphere') {
        // explode
        pr.dead = true;
        burst(pr.x, WORLD.floor - 10, '#ff5c5c', 14);
        sfx('hit');
        shake = Math.max(shake, 5);
        for (const p of players) {
          if (p === pr.owner) continue;
          if (Math.hypot(p.x - pr.x, (p.y - PLAYER_H / 2) - pr.y) < 85) hitPlayer(p, pr);
        }
        continue;
      } else if (pr.bounces > 0) {
        pr.y = WORLD.floor - pr.r;
        pr.vy = pr.type === 'screw' ? -420 : pr.vy * -0.72;
        pr.bounces--;
      } else if (pr.grav) {
        pr.dead = true; continue;
      } else {
        pr.y = WORLD.floor - pr.r;
      }
    }
    if (pr.x < -30 || pr.x > WORLD.w + 30) { pr.dead = true; continue; }

    // hit detection
    for (const p of players) {
      if (p === pr.owner || pr.dead) continue;
      if (Math.abs(pr.x - p.x) < PLAYER_W / 2 + pr.r && pr.y > p.y - PLAYER_H - pr.r && pr.y < p.y + pr.r) {
        if (p.hitImmuneT > 0) continue;
        pr.dead = true;
        hitPlayer(p, pr);
      }
    }
  }
  projectiles = projectiles.filter(p => !p.dead);
}

// ---------- update ----------
let lastT = performance.now();
function frame(now) {
  let dt = Math.min((now - lastT) / 1000, 1 / 30);
  lastT = now;
  pollInput();

  if (state === 'game') {
    if (freezeT > 0) {
      freezeT -= dt;
      if (freezeT <= 0 && pendingInbound) applyInbound();
    } else {
      if (tipT > 0) tipT -= dt;
      if (!suddenDeath) {
        clock -= dt;
        if (clock <= 0) {
          clock = 0;
          if (players[0].score !== players[1].score) {
            endGame(players[0].score > players[1].score ? players[0] : players[1]);
          } else {
            suddenDeath = true;
            banner('SUDDEN DEATH!', '#ff5c5c', 'NEXT BASKET WINS', 2);
            sfx('buzzer');
          }
        }
      }
      if (state === 'game') {
        for (const p of players) updatePlayer(p, dt);
        updateBall(dt);
        updateProjectiles(dt);
      }
    }
  }

  // particles & banners always tick
  for (const pt of particles) {
    pt.life -= dt; pt.vy += G * 0.5 * dt;
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
  }
  particles = particles.filter(p => p.life > 0);
  for (const b of banners) {
    if (b.delay > 0) b.delay -= dt;
    else b.t -= dt;
  }
  banners = banners.filter(b => b.t > 0);
  if (shake > 0) shake = Math.max(0, shake - dt * 30);

  render();
  taps = [];
}

// ---------- rendering ----------
function render() {
  ctx.clearRect(0, 0, CW, CH);
  if (state === 'title') { renderTitle(); return; }
  if (state === 'select') { renderSelect(); return; }
  renderCourtScene();
  if (state === 'over') renderOver();
}

function worldTransform() {
  const scale = CH / WORLD.h;
  const viewW = CW / scale;
  // camera follows ball
  const target = ball ? clamp(ball.x, viewW / 2, WORLD.w - viewW / 2) : WORLD.w / 2;
  camX = lerp(camX, target, 0.08);
  if (viewW >= WORLD.w) camX = WORLD.w / 2;
  const sx = (shake > 0) ? rnd(-shake, shake) : 0;
  const sy = (shake > 0) ? rnd(-shake, shake) : 0;
  return { scale, viewW, offX: camX - viewW / 2 - sx / scale, offY: sy };
}

function renderCourtScene() {
  const { scale, viewW, offX, offY } = worldTransform();
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-offX, offY);

  drawArena(offX, viewW);

  // hoops
  drawHoop(HOOPS.left, 'left');
  drawHoop(HOOPS.right, 'right');

  // players (ball holder drawn last so ball is on top-ish)
  const order = [...players].sort((a, b) => (a.hasBall ? 1 : 0) - (b.hasBall ? 1 : 0));
  for (const p of order) drawPlayer(p);

  drawBallSprite();

  // projectiles
  for (const pr of projectiles) drawProjectile(pr);

  // particles
  for (const pt of particles) {
    ctx.globalAlpha = clamp(pt.life * 2.5, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.r / 2, pt.y - pt.r / 2, pt.r, pt.r);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  renderHUD();
  if (state === 'game') renderControls();
  renderBanners();
}

function drawArena(offX, viewW) {
  // sky/arena dark
  const grd = ctx.createLinearGradient(0, 0, 0, WORLD.h);
  grd.addColorStop(0, '#101024');
  grd.addColorStop(1, '#1c1c34');
  ctx.fillStyle = grd;
  ctx.fillRect(offX - 50, -60, viewW + 100, WORLD.h + 120);

  // crowd rows
  for (let row = 0; row < 4; row++) {
    const y = 120 + row * 34;
    ctx.fillStyle = row % 2 ? '#23233c' : '#282844';
    ctx.fillRect(offX - 50, y, viewW + 100, 34);
    const seed = 91 + row * 37;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    const start = Math.floor((offX - 60) / 26);
    for (let i = start; i < start + viewW / 26 + 6; i++) {
      const h = ((i * seed) % 7);
      ctx.beginPath();
      ctx.arc(i * 26 + (row % 2) * 13, y + 12 + (h % 3) * 2, 7, Math.PI, 0);
      ctx.fill();
    }
  }

  // banner wall
  ctx.fillStyle = '#151528';
  ctx.fillRect(offX - 50, 256, viewW + 100, 40);
  ctx.fillStyle = '#3c3c66';
  ctx.font = "bold 22px 'Courier New', monospace";
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let bx = 0; bx < WORLD.w + 400; bx += 420) {
    ctx.fillText('★ TOURNAMENT OF CHAMPIONS X ★', bx - 200, 277);
  }

  // floor
  const fgrd = ctx.createLinearGradient(0, WORLD.floor, 0, WORLD.h + 60);
  fgrd.addColorStop(0, '#c98d4e');
  fgrd.addColorStop(1, '#8f5f30');
  ctx.fillStyle = fgrd;
  ctx.fillRect(offX - 50, WORLD.floor, viewW + 100, WORLD.h - WORLD.floor + 120);
  // boards / planks
  ctx.strokeStyle = 'rgba(120,70,25,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(offX - 50, WORLD.floor + 1); ctx.lineTo(offX + viewW + 50, WORLD.floor + 1);
  ctx.stroke();
  // court markings
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 4;
  // center line + circle
  ctx.beginPath(); ctx.moveTo(WORLD.w / 2, WORLD.floor); ctx.lineTo(WORLD.w / 2, WORLD.floor + 60); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(WORLD.w / 2, WORLD.floor + 30, 70, 18, 0, 0, 7); ctx.stroke();
  // 3pt markers
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  for (const key of ['left', 'right']) {
    const hp = HOOPS[key];
    const x3 = hp.x + (key === 'left' ? THREE_DIST : -THREE_DIST);
    ctx.beginPath(); ctx.moveTo(x3, WORLD.floor); ctx.lineTo(x3, WORLD.floor + 46); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hp.x, WORLD.floor + 24, 90, 14, 0, 0, 7); ctx.stroke();
  }
}

function drawHoop(hp, side) {
  const bx = hp.boardX;
  // pole
  ctx.fillStyle = '#3a3a52';
  const poleX = side === 'left' ? bx - 26 : bx + 18;
  ctx.fillRect(poleX, hp.rimY - 40, 8, WORLD.floor - hp.rimY + 40);
  ctx.fillRect(side === 'left' ? poleX : bx - 4, hp.rimY - 44, 30, 7);
  // backboard
  ctx.fillStyle = 'rgba(230,240,255,0.85)';
  ctx.fillRect(bx - 3, hp.rimY - 78, 6, 92);
  ctx.strokeStyle = '#e05430'; ctx.lineWidth = 3;
  ctx.strokeRect(bx - 3, hp.rimY - 40, 6, 34);
  // rim
  ctx.strokeStyle = '#ff5a2a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hp.x - RIM_HALF, hp.rimY);
  ctx.lineTo(hp.x + RIM_HALF, hp.rimY);
  ctx.stroke();
  // net
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    const nx = hp.x - RIM_HALF + (RIM_HALF * 2 / 4) * i;
    ctx.beginPath();
    ctx.moveTo(nx, hp.rimY + 2);
    ctx.lineTo(hp.x + (nx - hp.x) * 0.5, hp.rimY + 34);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(hp.x - RIM_HALF * 0.5, hp.rimY + 34);
  ctx.lineTo(hp.x + RIM_HALF * 0.5, hp.rimY + 34);
  ctx.stroke();
}

function drawPlayer(p) {
  const pose = {
    run: p.onGround && Math.abs(p.vx) > 30 ? p.runPhase : -1,
    air: !p.onGround,
    stun: p.stunT > 0,
    holdBall: p.hasBall,
    shootRaise: p.shootRaise,
    shadowY: WORLD.floor - p.y,
  };
  // on-fire trail
  if (p.onFire) {
    for (let i = 0; i < 2; i++) {
      particles.push({
        x: p.x + rnd(-10, 10), y: p.y - rnd(4, PLAYER_H * 0.8),
        vx: rnd(-20, 20), vy: rnd(-140, -60),
        life: rnd(0.2, 0.45), color: pick(['#ff7b2a', '#ffb52a', '#ff4a2a']), r: rnd(2.5, 5),
      });
    }
  }
  // blink while immune
  if (p.hitImmuneT > 0 && p.stunT <= 0 && Math.floor(performance.now() / 90) % 2 === 0) ctx.globalAlpha = 0.5;
  pose.shadowY = 0;
  ctx.save();
  ctx.translate(0, 0);
  // shadow at floor regardless of jump height
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(p.x, WORLD.floor + 4, 22, 5, 0, 0, 7);
  ctx.fill();
  drawBot(ctx, p.ch, p.x, p.y, PLAYER_H, p.facing, Object.assign(pose, { noShadow: true }));
  ctx.restore();
  ctx.globalAlpha = 1;

  // P1 marker / name tag
  const label = p.isAI ? 'CPU' : 'P1';
  ctx.fillStyle = p.isAI ? '#ff6e6e' : '#6ee7ff';
  ctx.font = "bold 13px 'Courier New', monospace";
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(label, p.x, p.y - PLAYER_H - 18);
  ctx.beginPath();
  ctx.moveTo(p.x - 5, p.y - PLAYER_H - 14);
  ctx.lineTo(p.x + 5, p.y - PLAYER_H - 14);
  ctx.lineTo(p.x, p.y - PLAYER_H - 8);
  ctx.fill();
}

function drawBallSprite() {
  if (!ball) return;
  const { x, y } = ball;
  if (ball.fire) {
    for (let i = 0; i < 2; i++) {
      particles.push({
        x: x + rnd(-4, 4), y: y + rnd(-4, 4),
        vx: -ball.vx * 0.05 + rnd(-20, 20), vy: rnd(-90, -30),
        life: rnd(0.15, 0.35), color: pick(['#ff7b2a', '#ffd12a']), r: rnd(2, 4.5),
      });
    }
  }
  ctx.fillStyle = ball.fire ? '#ff5a1f' : '#e2762c';
  ctx.beginPath(); ctx.arc(x, y, BALL_R, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(60,25,5,0.8)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(x, y, BALL_R, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - BALL_R, y); ctx.lineTo(x + BALL_R, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - BALL_R); ctx.lineTo(x, y + BALL_R); ctx.stroke();
}

function drawProjectile(pr) {
  ctx.save();
  ctx.translate(pr.x, pr.y);
  switch (pr.type) {
    case 'cosmic': {
      ctx.rotate(pr.age * 9);
      ctx.fillStyle = '#2a1252';
      ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#b98cff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, 7); ctx.stroke();
      ctx.fillStyle = '#e8d9ff';
      ctx.fillRect(-1.5, -pr.r + 2, 3, 3); ctx.fillRect(pr.r - 6, 1, 3, 3);
      break;
    }
    case 'medisphere': {
      ctx.rotate(pr.age * 6);
      ctx.fillStyle = '#f2f2f2';
      ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * pr.r, Math.sin(a) * pr.r);
        ctx.lineTo(Math.cos(a) * (pr.r + 4), Math.sin(a) * (pr.r + 4));
        ctx.stroke();
      }
      ctx.fillStyle = '#cf2233';
      ctx.fillRect(-2, -6, 4, 12); ctx.fillRect(-6, -2, 12, 4);
      break;
    }
    case 'nails': {
      ctx.rotate(Math.atan2(pr.vy, pr.vx));
      ctx.strokeStyle = '#8a5a2c'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-7, -4); ctx.lineTo(-7, 4); ctx.stroke();
      break;
    }
    case 'screw': {
      ctx.rotate(pr.age * 14);
      ctx.fillStyle = '#b9bcc4';
      ctx.fillRect(-pr.r, -4, pr.r * 2, 8);
      ctx.fillRect(-pr.r, -7, 6, 14);
      ctx.strokeStyle = '#7c7f88'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(2, 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, -4); ctx.lineTo(7, 4); ctx.stroke();
      break;
    }
    case 'saw': {
      ctx.rotate(pr.age * 16);
      ctx.fillStyle = '#c8ccd4';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5;
        ctx.lineTo(Math.cos(a) * pr.r, Math.sin(a) * pr.r);
        ctx.lineTo(Math.cos(a + 0.3) * (pr.r * 0.7), Math.sin(a + 0.3) * (pr.r * 0.7));
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b5271d';
      ctx.beginPath(); ctx.arc(0, 0, pr.r * 0.4, 0, 7); ctx.fill();
      break;
    }
    case 'sonic': {
      // blue energy orb — deliberately NOT basketball-colored
      ctx.fillStyle = '#1d4fd7';
      ctx.beginPath(); ctx.arc(0, 0, pr.r * 0.8, 0, 7); ctx.fill();
      ctx.fillStyle = '#bcd6ff';
      ctx.beginPath(); ctx.arc(0, 0, pr.r * 0.4, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(90,160,255,0.8)'; ctx.lineWidth = 2;
      const ph = (pr.age * 3) % 1;
      for (let i = 0; i < 2; i++) {
        const rr2 = pr.r + ((ph + i * 0.5) % 1) * 14;
        ctx.globalAlpha = 1 - ((ph + i * 0.5) % 1);
        ctx.beginPath(); ctx.arc(0, 0, rr2, 0, 7); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'lockball': {
      ctx.rotate(pr.age * 5);
      ctx.fillStyle = '#2b57c4';
      ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#d3a11c'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, pr.r * 0.55, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#d3a11c';
      ctx.fillRect(-pr.r * 0.45, -1, pr.r * 0.9, pr.r * 0.75);
      break;
    }
  }
  ctx.restore();
}

// ---------- HUD ----------
function fmtClock(t) {
  const m = Math.floor(t / 60), s = Math.ceil(t % 60);
  const ss = s === 60 ? 0 : s;
  const mm = s === 60 ? m + 1 : m;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

function renderHUD() {
  const p1 = players[0], p2 = players[1];
  const w = Math.min(CW * 0.9, 640);
  const x0 = (CW - w) / 2;
  const h = 44;

  ctx.fillStyle = 'rgba(8,8,18,0.78)';
  rr(ctx, x0, 8, w, h, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
  rr(ctx, x0, 8, w, h, 12); ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.font = "bold 15px 'Courier New', monospace";
  // names + scores
  ctx.textAlign = 'left';
  ctx.fillStyle = p1.onFire ? '#ff8c3a' : '#6ee7ff';
  ctx.fillText(`${p1.onFire ? '🔥' : ''}${p1.ch.name}`, x0 + 14, 8 + h / 2);
  ctx.textAlign = 'right';
  ctx.fillStyle = p2.onFire ? '#ff8c3a' : '#ff6e6e';
  ctx.fillText(`${p2.ch.name}${p2.onFire ? '🔥' : ''}`, x0 + w - 14, 8 + h / 2);

  ctx.textAlign = 'center';
  ctx.font = "bold 26px 'Courier New', monospace";
  ctx.fillStyle = '#fff';
  ctx.fillText(`${p1.score}`, x0 + w * 0.32, 8 + h / 2);
  ctx.fillText(`${p2.score}`, x0 + w * 0.68, 8 + h / 2);

  ctx.font = "bold 18px 'Courier New', monospace";
  ctx.fillStyle = suddenDeath ? '#ff5c5c' : (clock < 10 ? '#ffd94a' : '#dfe3f0');
  ctx.fillText(suddenDeath ? 'SD' : fmtClock(clock), x0 + w / 2, 8 + h / 2);
}

function renderControls() {
  buttons = [];
  const u = Math.min(CW, CH) / 7.2;         // button radius unit
  const pad = u * 0.55;
  const by = CH - u - pad;
  const p1 = players[0];

  const defs = [
    { id: 'left', x: pad + u, y: by, r: u, label: '◀' },
    { id: 'right', x: pad + u * 3.3, y: by, r: u, label: '▶' },
    { id: 'power', x: CW - pad - u * 3.6, y: by - u * 1.7, r: u * 0.82, label: 'PWR' },
    { id: 'jump', x: CW - pad - u * 3.3, y: by, r: u, label: 'JUMP' },
    { id: 'shoot', x: CW - pad - u, y: by, r: u, label: p1.hasBall ? 'SHOOT' : 'STEAL' },
  ];
  for (const b of defs) {
    buttons.push(b);
    const active = input[b.id];
    ctx.fillStyle = active ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.13)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.stroke();

    if (b.id === 'power' && p1.cd > 0) {
      // cooldown pie
      const frac = p1.cd / (p1.ch.stats.cd * (p1.onFire ? 0.6 : 1));
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `bold ${b.r * (b.label.length > 2 ? 0.34 : 0.6)}px 'Courier New', monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x, b.y);
  }
  // power name hint
  const pw = players[0].ch.power.name;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `bold ${u * 0.26}px 'Courier New', monospace`;
  ctx.fillText(pw, CW - pad - u * 3.6, by - u * 1.7 - u);
}

function renderBanners() {
  let y = CH * 0.3;
  for (const b of banners) {
    if (b.delay > 0) continue;
    const a = clamp(b.t / 0.25, 0, 1) * clamp((b.dur - b.t) / 0.15, 0, 1);
    const pop = 1 + 0.25 * clamp(1 - (b.dur - b.t) / 0.18, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(CW / 2, y);
    ctx.scale(pop, pop);
    ctx.font = `italic 900 ${Math.min(CW * 0.055, 40)}px 'Courier New', monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineJoin = 'round';
    ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, 0, 0);
    if (b.sub) {
      ctx.font = `bold ${Math.min(CW * 0.026, 18)}px 'Courier New', monospace`;
      ctx.strokeText(b.sub, 0, Math.min(CW * 0.05, 34));
      ctx.fillStyle = '#fff';
      ctx.fillText(b.sub, 0, Math.min(CW * 0.05, 34));
    }
    ctx.restore();
    y += Math.min(CW * 0.09, 64);
  }
}

// ---------- title ----------
let titleBallY = 0, titleBallV = 0;
function renderTitle() {
  buttons = [];
  const grd = ctx.createLinearGradient(0, 0, 0, CH);
  grd.addColorStop(0, '#101024');
  grd.addColorStop(1, '#241c38');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, CW, CH);

  // starfield
  for (let i = 0; i < 40; i++) {
    const sx = (i * 137.5) % CW, sy = (i * 91.7) % (CH * 0.7);
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 700 + i));
    ctx.globalAlpha = tw * 0.7;
    ctx.fillStyle = '#cdd7ff';
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;

  const cx = CW / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const big = Math.min(CW * 0.14, CH * 0.24);
  ctx.font = `italic 900 ${big}px 'Courier New', monospace`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = big * 0.16; ctx.strokeStyle = '#0b0b14';
  ctx.strokeText('ToCX JAM', cx, CH * 0.3);
  const tg = ctx.createLinearGradient(0, CH * 0.3 - big / 2, 0, CH * 0.3 + big / 2);
  tg.addColorStop(0, '#6ee7ff'); tg.addColorStop(0.5, '#3b82f6'); tg.addColorStop(1, '#c92a3a');
  ctx.fillStyle = tg;
  ctx.fillText('ToCX JAM', cx, CH * 0.3);

  ctx.font = `bold ${Math.min(CW * 0.028, 18)}px 'Courier New', monospace`;
  ctx.fillStyle = '#ffd94a';
  ctx.fillText('★ TOURNAMENT OF CHAMPIONS: ROBOT HOOPS ★', cx, CH * 0.3 + big * 0.72);

  // bouncing ball
  titleBallV += G * 0.7 / 60;
  titleBallY += titleBallV / 60;
  if (titleBallY > 0) { titleBallY = 0; titleBallV = -520; }
  const bx2 = cx, by2 = CH * 0.68 + titleBallY;
  ctx.fillStyle = '#e2762c';
  ctx.beginPath(); ctx.arc(bx2, by2, 16, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(60,25,5,0.8)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(bx2, by2, 16, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx2 - 16, by2); ctx.lineTo(bx2 + 16, by2); ctx.stroke();

  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  if (blink) {
    ctx.font = `bold ${Math.min(CW * 0.035, 24)}px 'Courier New', monospace`;
    ctx.fillStyle = '#fff';
    ctx.fillText('TAP TO START', cx, CH * 0.8);
  }

  ctx.font = `bold ${Math.min(CW * 0.018, 13)}px 'Courier New', monospace`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('KEYBOARD: ← → MOVE   ·   Z JUMP   ·   X SHOOT / STEAL   ·   C POWER', cx, CH * 0.92);

  if (taps.length) {
    sfx('go');
    selectPhase = 0; selP1 = null; selP2 = null;
    state = 'select';
  }
}

// ---------- character select ----------
let selectRects = [];
function renderSelect() {
  buttons = [];
  const grd = ctx.createLinearGradient(0, 0, 0, CH);
  grd.addColorStop(0, '#101024'); grd.addColorStop(1, '#241c38');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, CW, CH);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.min(CW * 0.04, 26)}px 'Courier New', monospace`;
  ctx.fillStyle = selectPhase === 0 ? '#6ee7ff' : '#ff6e6e';
  ctx.fillText(selectPhase === 0 ? 'CHOOSE YOUR PLAYER' : 'CHOOSE YOUR OPPONENT', CW / 2, CH * 0.09);

  // grid of 8 (7 chars + random)
  const cols = 4, rows = 2;
  const gw = Math.min(CW * 0.86, 700);
  const tile = Math.min(gw / cols - 10, CH * 0.26);
  const gx = (CW - (tile + 10) * cols + 10) / 2;
  const gy = CH * 0.15;
  selectRects = [];

  const current = selectPhase === 0 ? selP1 : selP2;

  for (let i = 0; i < 8; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const x = gx + col * (tile + 10), y = gy + row * (tile + 10);
    const ch = i < CHARACTERS.length ? CHARACTERS[i] : null; // last = random
    selectRects.push({ x, y, w: tile, h: tile, ch });

    const isSel = current && ((ch && current === ch) || (!ch && current === 'random'));
    ctx.fillStyle = isSel ? 'rgba(255,217,74,0.25)' : 'rgba(255,255,255,0.07)';
    rr(ctx, x, y, tile, tile, 10); ctx.fill();
    ctx.strokeStyle = isSel ? '#ffd94a' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = isSel ? 3 : 1.5;
    rr(ctx, x, y, tile, tile, 10); ctx.stroke();

    if (ch) {
      drawHead(ctx, ch, x + tile / 2, y + tile * 0.42, tile * 0.2, 1);
      ctx.font = `bold ${tile * 0.11}px 'Courier New', monospace`;
      ctx.fillStyle = '#fff';
      ctx.fillText(ch.name, x + tile / 2, y + tile * 0.85);
    } else {
      ctx.font = `900 ${tile * 0.4}px 'Courier New', monospace`;
      ctx.fillStyle = '#c792ff';
      ctx.fillText('?', x + tile / 2, y + tile * 0.45);
      ctx.font = `bold ${tile * 0.11}px 'Courier New', monospace`;
      ctx.fillStyle = '#fff';
      ctx.fillText('RANDOM', x + tile / 2, y + tile * 0.85);
    }
  }

  // detail bar
  const sel = current;
  const dy = gy + rows * (tile + 10) + 4;
  if (sel) {
    const ch = sel === 'random' ? null : sel;
    ctx.font = `bold ${Math.min(CW * 0.024, 15)}px 'Courier New', monospace`;
    ctx.fillStyle = '#ffd94a';
    if (ch) {
      ctx.fillText(`${ch.name} — ${ch.blurb}`, CW / 2, dy + 10);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(`${ch.power.name} ▸ ${ch.passive}`, CW / 2, dy + 30);
    } else {
      ctx.fillText('RANDOM — leave it to fate!', CW / 2, dy + 10);
    }
    // GO button
    const bw = Math.min(CW * 0.3, 200), bh = 44;
    const bx3 = CW / 2 - bw / 2, by3 = Math.min(dy + 46, CH - bh - 8);
    ctx.fillStyle = '#c92a3a';
    rr(ctx, bx3, by3, bw, bh, 12); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${bh * 0.5}px 'Courier New', monospace`;
    ctx.fillText(selectPhase === 0 ? 'NEXT ▸' : 'JAM! ▸', CW / 2, by3 + bh / 2);
    selectRects.push({ x: bx3, y: by3, w: bw, h: bh, go: true });
  } else {
    ctx.font = `bold ${Math.min(CW * 0.024, 15)}px 'Courier New', monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('TAP A CHARACTER', CW / 2, dy + 16);
  }

  // handle taps (at most one per frame; go-button taps end processing entirely)
  outer:
  for (const t of taps) {
    for (const r2 of selectRects) {
      if (t.x >= r2.x && t.x <= r2.x + r2.w && t.y >= r2.y && t.y <= r2.y + r2.h) {
        if (r2.go) {
          if (selectPhase === 0 && selP1) {
            sfx('go');
            selectPhase = 1;
          } else if (selectPhase === 1 && selP1 && selP2) {
            sfx('go');
            const c1 = selP1 === 'random' ? pick(CHARACTERS) : selP1;
            const c2 = selP2 === 'random' ? pick(CHARACTERS.filter(c => c !== c1)) : selP2;
            startGame(c1, c2);
          }
          break outer;
        } else {
          sfx('select');
          if (selectPhase === 0) selP1 = r2.ch || 'random';
          else selP2 = r2.ch || 'random';
          break outer;
        }
      }
    }
  }
  taps = [];
}

// ---------- game over ----------
function renderOver() {
  buttons = [];
  ctx.fillStyle = 'rgba(5,5,14,0.82)';
  ctx.fillRect(0, 0, CW, CH);

  const p1 = players[0], p2 = players[1];
  const youWon = winner === p1;

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `italic 900 ${Math.min(CW * 0.08, 54)}px 'Courier New', monospace`;
  ctx.lineWidth = 8; ctx.strokeStyle = '#0b0b14'; ctx.lineJoin = 'round';
  const msg = youWon ? 'YOU WIN!' : 'CPU WINS!';
  ctx.strokeText(msg, CW / 2, CH * 0.2);
  ctx.fillStyle = youWon ? '#9dff6e' : '#ff6e6e';
  ctx.fillText(msg, CW / 2, CH * 0.2);

  drawHead(ctx, winner.ch, CW / 2, CH * 0.44, Math.min(CW, CH) * 0.09, 1);

  ctx.font = `bold ${Math.min(CW * 0.045, 30)}px 'Courier New', monospace`;
  ctx.fillStyle = '#fff';
  ctx.fillText(`${p1.score}  —  ${p2.score}`, CW / 2, CH * 0.62);
  ctx.font = `bold ${Math.min(CW * 0.026, 17)}px 'Courier New', monospace`;
  ctx.fillStyle = '#ffd94a';
  ctx.fillText(`${winner.ch.name} TAKES THE CROWN`, CW / 2, CH * 0.7);

  // buttons
  const bw = Math.min(CW * 0.34, 230), bh = 46, gap = 16;
  const bx4 = CW / 2 - bw - gap / 2, bx5 = CW / 2 + gap / 2;
  const by4 = CH * 0.8;
  ctx.fillStyle = '#c92a3a';
  rr(ctx, bx4, by4, bw, bh, 12); ctx.fill();
  ctx.fillStyle = '#2b57c4';
  rr(ctx, bx5, by4, bw, bh, 12); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${bh * 0.42}px 'Courier New', monospace`;
  ctx.fillText('REMATCH', bx4 + bw / 2, by4 + bh / 2);
  ctx.fillText('CHARACTERS', bx5 + bw / 2, by4 + bh / 2);

  for (const t of taps) {
    if (t.y >= by4 && t.y <= by4 + bh) {
      if (t.x >= bx4 && t.x <= bx4 + bw) {
        sfx('go');
        startGame(p1.ch, p2.ch);
      } else if (t.x >= bx5 && t.x <= bx5 + bw) {
        sfx('go');
        selectPhase = 0; selP1 = null; selP2 = null;
        state = 'select';
      }
    }
  }
}

function rafLoop(now) {
  requestAnimationFrame(rafLoop);
  frame(now);
}
requestAnimationFrame(rafLoop);
// fallback: some browsers/webviews throttle rAF hard — keep the game ticking
setInterval(() => {
  if (performance.now() - lastT > 100) frame(performance.now());
}, 50);
})();
