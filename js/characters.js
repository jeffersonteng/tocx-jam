// ToCX JAM — character data + robot drawing
// Original stylized robot sprites drawn with canvas primitives.

const CHARACTERS = [
  {
    id: 'space', name: 'SPACE MAN', dwn: '031',
    blurb: 'A hoop star from another star. Huge hops.',
    passive: 'MOON BOOTS: highest jump in the league.',
    pal: { main:'#5b3fa8', dark:'#3a2570', light:'#efeaf7', trim:'#f4b62a', skin:'#e8b98c', hair:'#8a5a2b' },
    features: { bubble:true },
    emblem: 'saturn',
    stats: { speed:320, jump:1120, three:0.34, mid:0.52, dunk:175, steal:0.22, cd:3.0 },
    power: { type:'cosmic', name:'COSMIC BALL' },
  },
  {
    id: 'hurt', name: 'HURT MAN', dwn: '030',
    blurb: 'Thrives in pain. Never stops smiling.',
    passive: 'PAIN BOOST: speed + accuracy up when trailing.',
    pal: { main:'#e8e8ea', dark:'#b9b9c0', light:'#ffffff', trim:'#cf2233', skin:'#b57a4e', hair:'#241d18' },
    features: { beard:true, smile:true, bandage:true },
    emblem: 'cross',
    stats: { speed:300, jump:900, three:0.33, mid:0.52, dunk:150, steal:0.25, cd:3.5 },
    power: { type:'medisphere', name:'MEDI-SPHERE' },
  },
  {
    id: 'nail', name: 'NAIL MAN', dwn: '033',
    blurb: 'Built for endurance. Every hit makes him stronger.',
    passive: 'HARDENED: recovers from stuns twice as fast.',
    pal: { main:'#c03a2b', dark:'#8e2a1f', light:'#f2efe9', trim:'#243352', skin:'#caa07a', hair:'#2c2320' },
    features: { curly:true, smile:true },
    emblem: 'nails',
    stats: { speed:310, jump:940, three:0.35, mid:0.53, dunk:155, steal:0.24, cd:3.2 },
    power: { type:'nails', name:'RUSTY NAIL' },
  },
  {
    id: 'old', name: 'OLD MAN', dwn: '041',
    blurb: 'Busted knees, sharpest instincts. Still got game.',
    passive: 'VETERAN: deadly from three, hard to strip.',
    pal: { main:'#211f22', dark:'#121114', light:'#e9e4da', trim:'#d3a11c', skin:'#e3b591', hair:'#4c4038' },
    features: { glasses:true },
    emblem: '41',
    stats: { speed:258, jump:760, three:0.50, mid:0.62, dunk:90, steal:0.30, cd:2.8 },
    power: { type:'screw', name:'LOOSE SCREW' },
  },
  {
    id: 'nocut', name: 'NO-CUT MAN', dwn: '027',
    blurb: 'Believes all cutting is wasteful. Will cut nothing... except you.',
    passive: 'NO-CUT SAW: massive knockback on hit.',
    pal: { main:'#b5271d', dark:'#801a12', light:'#f0ece4', trim:'#e0a422', skin:'#d9a678', hair:'#31261d' },
    features: { beard:true },
    emblem: 'nocut',
    stats: { speed:292, jump:920, three:0.30, mid:0.50, dunk:160, steal:0.23, cd:3.4 },
    power: { type:'saw', name:'NO-CUT SAW' },
  },
  {
    id: 'blind', name: 'BLIND MAN', dwn: '029',
    blurb: 'Sees through sound. Always knows where you are.',
    passive: 'ECHO SCAN: best steal hands in the game.',
    pal: { main:'#1d4fd7', dark:'#12308a', light:'#23262b', trim:'#cfd6e4', skin:'#d8a677', hair:'#191512' },
    features: { goggles:true, buzz:true },
    emblem: 'target',
    stats: { speed:315, jump:930, three:0.36, mid:0.55, dunk:140, steal:0.48, cd:3.6 },
    power: { type:'sonic', name:'SONIC BALL' },
  },
  {
    id: 'lock', name: 'LOCK MAN', dwn: '028',
    blurb: 'Controls the game with perfect defense.',
    passive: 'LOCKDOWN: his Lock Ball stuns extra long.',
    pal: { main:'#efe9e0', dark:'#c9c2b6', light:'#ffffff', trim:'#2b57c4', skin:'#8a5a3b', hair:'#9a948c' },
    features: { grayBeard:true, bald:true },
    emblem: 'lock',
    stats: { speed:285, jump:880, three:0.32, mid:0.51, dunk:145, steal:0.36, cd:4.0 },
    power: { type:'lockball', name:'LOCK BALL' },
  },
];

// ---------- drawing helpers ----------

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawEmblem(ctx, type, x, y, s, pal) {
  ctx.save();
  ctx.translate(x, y);
  switch (type) {
    case 'saturn':
      ctx.fillStyle = '#f4b62a';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.55, 0, 7); ctx.fill();
      ctx.strokeStyle = '#d89a10'; ctx.lineWidth = Math.max(1, s * 0.18);
      ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.32, -0.35, 0, 7); ctx.stroke();
      break;
    case 'cross':
      ctx.fillStyle = '#cf2233';
      ctx.fillRect(-s * 0.3, -s, s * 0.6, s * 2);
      ctx.fillRect(-s, -s * 0.3, s * 2, s * 0.6);
      break;
    case 'nails':
      ctx.strokeStyle = '#7a4a24'; ctx.lineWidth = Math.max(1.5, s * 0.22); ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * s * 0.55, -s * 0.8);
        ctx.lineTo(i * s * 0.55 + i * s * 0.15, s * 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i * s * 0.55 - s * 0.25, -s * 0.8);
        ctx.lineTo(i * s * 0.55 + s * 0.25, -s * 0.8);
        ctx.stroke();
      }
      break;
    case '41':
      ctx.fillStyle = pal ? pal.light : '#fff';
      ctx.font = `bold ${Math.round(s * 1.7)}px 'Courier New', monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('41', 0, s * 0.1);
      break;
    case 'nocut':
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, s * 0.28);
      ctx.beginPath(); ctx.arc(0, 0, s * 0.8, 0, 7); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.57, -s * 0.57); ctx.lineTo(s * 0.57, s * 0.57);
      ctx.stroke();
      break;
    case 'target':
      ctx.strokeStyle = '#dfe6f2'; ctx.lineWidth = Math.max(1, s * 0.16);
      ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke();
      break;
    case 'lock':
      ctx.fillStyle = '#d3a11c';
      rr(ctx, -s * 0.7, -s * 0.35, s * 1.4, s * 1.1, s * 0.2); ctx.fill();
      ctx.strokeStyle = '#d3a11c'; ctx.lineWidth = Math.max(1.5, s * 0.25);
      ctx.beginPath(); ctx.arc(0, -s * 0.35, s * 0.42, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#3a3020';
      ctx.beginPath(); ctx.arc(0, s * 0.15, s * 0.18, 0, 7); ctx.fill();
      break;
  }
  ctx.restore();
}

// Draw a robot head (used at large size for menus, small for gameplay).
// cx, cy = center of head; s = head radius-ish scale; facing = 1 or -1
function drawHead(ctx, ch, cx, cy, s, facing = 1) {
  const p = ch.pal, f = ch.features;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(facing, 1);

  // helmet ring / neck
  ctx.fillStyle = p.dark;
  rr(ctx, -s * 0.9, s * 0.62, s * 1.8, s * 0.5, s * 0.2); ctx.fill();

  // face
  ctx.fillStyle = p.skin;
  rr(ctx, -s * 0.72, -s * 0.72, s * 1.44, s * 1.5, s * 0.5); ctx.fill();

  // hair
  ctx.fillStyle = p.hair;
  if (f.buzz) {
    rr(ctx, -s * 0.72, -s * 0.78, s * 1.44, s * 0.42, s * 0.3); ctx.fill();
  } else if (f.curly) {
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.arc(i * s * 0.3, -s * 0.62, s * 0.28, 0, 7); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(-s * 0.62, -s * 0.3, s * 0.24, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.62, -s * 0.3, s * 0.24, 0, 7); ctx.fill();
  } else if (f.bald) {
    // just a little on the sides
    ctx.fillRect(-s * 0.72, -s * 0.2, s * 0.12, s * 0.4);
  } else {
    // spiky
    rr(ctx, -s * 0.72, -s * 0.85, s * 1.44, s * 0.5, s * 0.25); ctx.fill();
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s * 0.28 - s * 0.12, -s * 0.6);
      ctx.lineTo(i * s * 0.28 + s * 0.05, -s * 1.05);
      ctx.lineTo(i * s * 0.28 + s * 0.2, -s * 0.6);
      ctx.fill();
    }
  }

  // eyes
  ctx.fillStyle = '#1d1a17';
  ctx.beginPath(); ctx.arc(s * 0.28, -s * 0.05, s * 0.09, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(-s * 0.18, -s * 0.05, s * 0.09, 0, 7); ctx.fill();

  // mouth
  ctx.strokeStyle = '#5b3a28'; ctx.lineWidth = Math.max(1, s * 0.08); ctx.lineCap = 'round';
  ctx.beginPath();
  if (f.smile) ctx.arc(s * 0.08, s * 0.32, s * 0.24, 0.15, Math.PI - 0.5);
  else { ctx.moveTo(-s * 0.08, s * 0.42); ctx.lineTo(s * 0.28, s * 0.42); }
  ctx.stroke();

  // beard
  if (f.beard || f.grayBeard) {
    ctx.fillStyle = f.grayBeard ? '#b8b2a8' : p.hair;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, s * 0.15);
    ctx.quadraticCurveTo(0, s * 1.05, s * 0.7, s * 0.15);
    ctx.lineTo(s * 0.7, s * 0.55);
    ctx.quadraticCurveTo(0, s * 1.15, -s * 0.7, s * 0.55);
    ctx.fill();
    ctx.globalAlpha = 1;
    // redraw mouth over beard
    ctx.strokeStyle = '#3a2a1e';
    ctx.beginPath();
    if (f.smile) ctx.arc(s * 0.08, s * 0.3, s * 0.2, 0.2, Math.PI - 0.6);
    else { ctx.moveTo(-s * 0.05, s * 0.4); ctx.lineTo(s * 0.25, s * 0.4); }
    ctx.stroke();
  }

  // glasses
  if (f.glasses) {
    ctx.strokeStyle = '#1c1c1e'; ctx.lineWidth = Math.max(1.2, s * 0.1);
    rr(ctx, -s * 0.42, -s * 0.28, s * 0.42, s * 0.4, s * 0.08); ctx.stroke();
    rr(ctx, s * 0.08, -s * 0.28, s * 0.42, s * 0.4, s * 0.08); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -s * 0.1); ctx.lineTo(s * 0.08, -s * 0.1); ctx.stroke();
  }
  if (f.goggles) {
    ctx.strokeStyle = '#cfd6e4'; ctx.lineWidth = Math.max(1.4, s * 0.12);
    ctx.fillStyle = 'rgba(180,210,255,0.25)';
    rr(ctx, -s * 0.58, -s * 0.3, s * 1.3, s * 0.46, s * 0.2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b6cff';
    ctx.fillRect(s * 0.6, -s * 0.24, s * 0.14, s * 0.14);
  }
  if (f.bandage) {
    ctx.strokeStyle = '#d9c49a'; ctx.lineWidth = Math.max(1.4, s * 0.12);
    ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.45); ctx.lineTo(-s * 0.2, -s * 0.62); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.52, -s * 0.6); ctx.lineTo(-s * 0.24, -s * 0.4); ctx.stroke();
  }

  // bubble helmet
  if (f.bubble) {
    ctx.strokeStyle = 'rgba(220,235,255,0.9)'; ctx.lineWidth = Math.max(1.4, s * 0.1);
    ctx.fillStyle = 'rgba(200,225,255,0.12)';
    ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 1.18, 0, 7);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = Math.max(1, s * 0.07);
    ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 1.02, -2.4, -1.4); ctx.stroke();
  }

  ctx.restore();
}

// Full robot. x = center x (world), y = FEET y. h = total height.
// pose: { run: 0..1 phase or -1, air: bool, stun: bool, holdBall: bool, shootRaise: 0..1 }
function drawBot(ctx, ch, x, y, h, facing, pose = {}) {
  const p = ch.pal;
  const s = h / 92; // scale unit
  ctx.save();
  ctx.translate(x, y);

  const legLen = 34 * s, torsoH = 34 * s, headS = 11 * s;
  const hipY = -legLen;
  const runP = pose.run != null && pose.run >= 0 ? pose.run : -1;
  const swing = runP >= 0 ? Math.sin(runP * Math.PI * 2) : 0;

  // shadow
  if (!pose.noShadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, pose.shadowY != null ? pose.shadowY : 0, 20 * s, 5 * s, 0, 0, 7);
    ctx.fill();
  }

  // ---- legs ----
  const drawLeg = (phase, back) => {
    const ang = pose.air ? (back ? 0.5 : -0.25) : swing * 0.55 * phase;
    ctx.save();
    ctx.translate(back ? -4 * s * facing : 4 * s * facing, hipY);
    ctx.rotate(ang * facing);
    ctx.fillStyle = back ? p.dark : p.main;
    rr(ctx, -5 * s, 0, 10 * s, legLen * 0.58, 4 * s); ctx.fill();
    // lower leg + shoe
    ctx.translate(0, legLen * 0.52);
    ctx.rotate(-ang * 0.6 * facing);
    ctx.fillStyle = back ? p.dark : p.main;
    rr(ctx, -4.5 * s, 0, 9 * s, legLen * 0.42, 3 * s); ctx.fill();
    ctx.fillStyle = p.light;
    rr(ctx, -5 * s, legLen * 0.34, 15 * s * (back ? 0.9 : 1), 7 * s, 3 * s); ctx.fill();
    ctx.fillStyle = p.trim;
    rr(ctx, -5 * s, legLen * 0.34, 15 * s * (back ? 0.9 : 1), 2.5 * s, 1.5 * s); ctx.fill();
    ctx.restore();
  };
  drawLeg(1, true);

  // ---- back arm ----
  const raise = pose.shootRaise || 0;
  const armDrop = pose.stun ? 0.9 : 0;
  const backArmAng = raise > 0 ? -2.4 * raise : (swing * -0.7 + 0.35 + armDrop);
  ctx.save();
  ctx.translate(-8 * s * facing, hipY - torsoH * 0.78);
  ctx.rotate(backArmAng * facing);
  ctx.fillStyle = p.dark;
  rr(ctx, -3.5 * s, 0, 7 * s, 22 * s, 3.5 * s); ctx.fill();
  ctx.fillStyle = p.light;
  ctx.beginPath(); ctx.arc(0, 23 * s, 4.5 * s, 0, 7); ctx.fill();
  ctx.restore();

  // ---- torso ----
  ctx.fillStyle = p.main;
  rr(ctx, -12 * s, hipY - torsoH, 24 * s, torsoH + 3 * s, 6 * s); ctx.fill();
  // jersey side stripe
  ctx.fillStyle = p.light;
  rr(ctx, -12 * s, hipY - torsoH, 7 * s, torsoH + 3 * s, 5 * s); ctx.fill();
  // belt
  ctx.fillStyle = p.trim;
  rr(ctx, -12 * s, hipY - 4 * s, 24 * s, 5 * s, 2 * s); ctx.fill();
  // shoulder pads
  ctx.fillStyle = p.dark;
  ctx.beginPath(); ctx.arc(-10 * s, hipY - torsoH * 0.82, 6.5 * s, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(10 * s, hipY - torsoH * 0.82, 6.5 * s, 0, 7); ctx.fill();
  // emblem
  drawEmblem(ctx, ch.emblem, 3 * s * facing, hipY - torsoH * 0.55, 5.5 * s, p);

  drawLeg(-1, false);

  // ---- head ----
  drawHead(ctx, ch, 0, hipY - torsoH - headS * 0.75, headS, facing);

  // ---- front arm (drawn last, holds ball) ----
  const frontArmAng = pose.holdBall
    ? (raise > 0 ? -2.6 * raise - 0.4 : -0.5)
    : (raise > 0 ? -2.6 * raise : (swing * 0.7 + 0.35 + armDrop));
  ctx.save();
  ctx.translate(8 * s * facing, hipY - torsoH * 0.78);
  ctx.rotate(frontArmAng * facing);
  ctx.fillStyle = p.main;
  rr(ctx, -3.5 * s, 0, 7 * s, 22 * s, 3.5 * s); ctx.fill();
  ctx.fillStyle = p.trim;
  rr(ctx, -4 * s, 12 * s, 8 * s, 6 * s, 2 * s); ctx.fill();
  ctx.fillStyle = p.light;
  ctx.beginPath(); ctx.arc(0, 23 * s, 4.5 * s, 0, 7); ctx.fill();
  ctx.restore();

  // stun stars
  if (pose.stun) {
    ctx.fillStyle = '#ffd94a';
    const t = performance.now() / 200;
    for (let i = 0; i < 3; i++) {
      const a = t + i * 2.1;
      const sx = Math.cos(a) * 16 * s, sy = -h - 6 * s + Math.sin(a) * 4 * s;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(a);
      ctx.font = `${Math.round(9 * s)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('★', 0, 0);
      ctx.restore();
    }
  }

  ctx.restore();
}

// Where the held ball should render, relative to player feet.
function ballHoldOffset(h, facing, raise) {
  const s = h / 92;
  if (raise > 0) {
    return { x: facing * (4 * s + 6 * s * (1 - raise)), y: -34 * s - 34 * s - raise * 26 * s };
  }
  return { x: facing * 16 * s, y: -34 * s - 20 * s };
}
