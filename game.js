// ─── Raven's Quest — vanilla JS + Canvas ───────────────────────────────────
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ─── HUD refs ─────────────────────────────────────────────────────────────
const hpEl    = document.getElementById('hp');
const scoreEl = document.getElementById('score');
const waveEl  = document.getElementById('wave');

// ─── Input ────────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true;  e.preventDefault(); });
window.addEventListener('keyup',   e => { keys[e.key] = false; });

// ─── Utility ──────────────────────────────────────────────────────────────
const rand  = (a, b) => Math.random() * (b - a) + a;
const randi = (a, b) => Math.floor(rand(a, b));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist  = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ─── Tile map Configuration ───────────────────────────────────────────────
const TILE   = 40;
const COLS   = 40;   
const ROWS   = 28;   

let MAP_TEMPLATE = [];

/**
 * Generates an open map with a solid border and scattered mountain peaks as obstacles.
 * 0 = Open Floor, 1 = Mountain Obstacle / Border Wall
 */
function generateRandomMaze() {
  MAP_TEMPLATE = [];
  
  // 1. Initialize an entirely open map
  for (let r = 0; r < ROWS; r++) {
    MAP_TEMPLATE.push(new Array(COLS).fill(0));
  }

  // 2. Set solid boundaries around the edges
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
        MAP_TEMPLATE[r][c] = 1;
      }
    }
  }

  // 3. Scatter individual mountain obstacles across the internal map area
  // ~22% coverage creates an organic scattering of mountains to fly around
  for (let r = 2; r < ROWS - 2; r++) {
    for (let c = 2; c < COLS - 2; c++) {
      if (Math.random() < 0.22) {
        MAP_TEMPLATE[r][c] = 1;
      }
    }
  }

  // 4. Clear player spawning safe zone (Top-Left corner area)
  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= 3; c++) {
      MAP_TEMPLATE[r][c] = 0;
    }
  }
}

function isSolid(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  return MAP_TEMPLATE[ty][tx] === 1;
}

// ─── Camera ───────────────────────────────────────────────────────────────
const cam = { x: 0, y: 0 };
function updateCam(px, py) {
  cam.x = clamp(px - W / 2, 0, COLS * TILE - W);
  cam.y = clamp(py - H / 2, 0, ROWS * TILE - H);
}

// ─── Tilemap drawing ──────────────────────────────────────────────────────
const PALETTE = {
  floor: '#1b4332',        // Clean green background terrain
  floorLine: '#2d6a4f40',    // Stylized subtle green grid lines
  wall: '#5c4033',      
  wallTop: '#8b5a2b',   
  mountainGrass: '#40916c', 
};

function drawTiles() {
  const startCol = Math.max(0, Math.floor(cam.x / TILE));
  const endCol = Math.min(COLS, Math.ceil((cam.x + W) / TILE));
  const startRow = Math.max(0, Math.floor(cam.y / TILE));
  const endRow = Math.min(ROWS, Math.ceil((cam.y + H) / TILE));

  for (let r = startRow; r < endRow; r++) {
    for (let c = startCol; c < endCol; c++) {
      const x = c * TILE - cam.x;
      const y = r * TILE - cam.y;
      const cell = MAP_TEMPLATE[r][c];
      const isBorder = (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1);

      if (cell === 1) {
        if (isBorder) {
          ctx.fillStyle = '#143626'; // Darker border ring
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#2d6a4f';
          ctx.fillRect(x, y, TILE, 6);
          ctx.strokeStyle = '#081c15';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x, y, TILE, TILE);
        } else {
          // Render beautiful textured isolated mountain peaks
          ctx.fillStyle = PALETTE.floor;
          ctx.fillRect(x, y, TILE, TILE);

          ctx.fillStyle = PALETTE.mountainGrass;
          ctx.beginPath();
          ctx.moveTo(x + TILE / 2, y + 12);
          ctx.lineTo(x + TILE, y + TILE);
          ctx.lineTo(x, y + TILE);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = PALETTE.wall;
          ctx.beginPath();
          ctx.moveTo(x + TILE / 2, y + 4);
          ctx.lineTo(x + TILE * 0.9, y + TILE * 0.95);
          ctx.lineTo(x + TILE * 0.1, y + TILE * 0.95);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = PALETTE.wallTop;
          ctx.beginPath();
          ctx.moveTo(x + TILE / 2, y + 4);
          ctx.lineTo(x + TILE / 2, y + TILE * 0.95);
          ctx.lineTo(x + TILE * 0.1, y + TILE * 0.95);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(x + TILE / 2, y + 4);
          ctx.lineTo(x + TILE * 0.62, y + 14);
          ctx.lineTo(x + TILE * 0.5, y + 12);
          ctx.lineTo(x + TILE * 0.38, y + 14);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        ctx.fillStyle = PALETTE.floor;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = PALETTE.floorLine;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, TILE, TILE);
      }
    }
  }
}

// ─── Raven Flight Sprite ──────────────────────────────────────────────────
function drawRaven(x, y, dir, flap, hp) {
  ctx.save();
  ctx.translate(x, y);

  // Derive precise directional canvas rotation base angles from current movement states
  if (dir === 'left') {
    ctx.scale(-1, 1);
  } else if (dir === 'up') {
    ctx.rotate(-Math.PI / 2);
  } else if (dir === 'down') {
    ctx.rotate(Math.PI / 2);
  }

  const flapOff = Math.sin(flap * 0.4) * 5;

  // Ground flight shadow mapping offset
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 22, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Primary Wing Mechanics
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.ellipse(-14, -2 + flapOff, 14, 7, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(14, -2 - flapOff, 14, 7, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Torso body definition
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head unit pointing cleanly forward along travel vector
  ctx.fillStyle = '#0f0f0f';
  ctx.beginPath();
  ctx.ellipse(12, 0, 7, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Glowing magical eye trackers
  const eyeGlow = 0.7 + Math.sin(flap * 0.1) * 0.3;
  ctx.fillStyle = `rgba(167, 139, 250, ${eyeGlow})`;
  ctx.beginPath();
  ctx.arc(13, -3, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(14, -3.5, 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Beak pointing directly along travel direction
  ctx.fillStyle = '#4a4a4a';
  ctx.beginPath();
  ctx.moveTo(18, -2);
  ctx.lineTo(26, 0);
  ctx.lineTo(18, 2);
  ctx.closePath();
  ctx.fill();

  // Tail feathers
  ctx.fillStyle = '#0f0f0f';
  ctx.beginPath();
  ctx.moveTo(-11, -4);
  ctx.lineTo(-22, -7);
  ctx.lineTo(-18, 0);
  ctx.lineTo(-22, 7);
  ctx.lineTo(-11, 4);
  ctx.closePath();
  ctx.fill();

  // Primary wing structural line definitions
  ctx.strokeStyle = '#2a2a3a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-4, -2 + flapOff);
  ctx.quadraticCurveTo(-14, 3 + flapOff, -24, 0 + flapOff);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(4, -2 - flapOff);
  ctx.quadraticCurveTo(14, 3 - flapOff, 24, 0 - flapOff);
  ctx.stroke();

  if (hp < 30) {
    ctx.fillStyle = `rgba(220,38,38,${Math.sin(Date.now() * 0.01) * 0.3 + 0.1})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ─── Green Worm / Collectible Orb ──────────────────────────────────────────
function drawOrb(orb, t) {
  const pulse = Math.sin(t * 3 + orb.phase) * 2;
  const r = 9 + pulse;
  ctx.save();
  ctx.translate(orb.x - cam.x, orb.y - cam.y);

  ctx.save();
  ctx.lineWidth = r * 1.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.25)'; // Lighter outline glow to separate from green background
  ctx.beginPath();
  const segments = 5;
  for (let i = 0; i <= segments; i++) {
    const segmentX = -r + (i * (r * 2)) / segments;
    const segmentY = Math.sin(t * 7 + i + orb.phase) * (r * 0.4);
    if (i === 0) ctx.moveTo(segmentX, segmentY);
    else ctx.lineTo(segmentX, segmentY);
  }
  ctx.stroke();
  ctx.restore();

  ctx.lineWidth = r * 0.55;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#facc15'; // Yellow core body for high readability on green maps
  
  ctx.beginPath();
  const wormPts = [];
  for (let i = 0; i <= segments; i++) {
    const bx = -r + (i * (r * 2)) / segments;
    const by = Math.sin(t * 7 + i + orb.phase) * (r * 0.4);
    wormPts.push({x: bx, y: by});
    if (i === 0) ctx.moveTo(bx, by);
    else ctx.lineTo(bx, by);
  }
  ctx.stroke();

  const head = wormPts[segments];

  ctx.fillStyle = '#ff7849'; 
  ctx.beginPath();
  ctx.arc(head.x - 1, head.y - 2, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1e293b'; 
  ctx.beginPath();
  ctx.arc(head.x - 0.8, head.y - 1.8, 0.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── Wraith (enemy) ───────────────────────────────────────────────────────
function drawWraith(w, t) {
  ctx.save();
  ctx.translate(w.x - cam.x, w.y - cam.y);
  const bob = Math.sin(t * 4 + w.phase) * 3;
  ctx.translate(0, bob);

  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
  grd.addColorStop(0, 'rgba(33, 32, 32, 0.5)');
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();

  const flap = Math.sin(t * 8 + w.phase) * 6;

  ctx.fillStyle = '#6f5737';
  ctx.beginPath();
  ctx.moveTo(-20, -4 + flap);
  ctx.quadraticCurveTo(-10, -8, -6, -6);
  ctx.lineTo(-4, -14);
  ctx.lineTo(4, -14);
  ctx.lineTo(6, -6);
  ctx.quadraticCurveTo(10, -8, 20, -4 + flap);
  ctx.lineTo(10, 4 + flap);
  ctx.lineTo(4, 12);
  ctx.lineTo(-4, 12);
  ctx.lineTo(-10, 4 + flap);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f10e0e';
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(5, -6);
  ctx.lineTo(0, -2);
  ctx.lineTo(-2, -6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fca5a5';
  ctx.beginPath();
  ctx.arc(-4, -8, 2.5, 0, Math.PI * 2);
  ctx.arc(4, -8, 2.5, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(-4, -8, 1, 0, Math.PI * 2);
  ctx.arc(4, -8, 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── Particle system ─────────────────────────────────────────────────────
const particles = [];
function spawnParticles(x, y, color, n = 10) {
  for (let i = 0; i < n; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(1, 5);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color,
      size: rand(2, 5),
    });
  }
}
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.1;
    p.life -= 0.035;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - cam.x, p.y - cam.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─── Screen flash ─────────────────────────────────────────────────────────
const flash = { alpha: 0, color: '#fff' };
function triggerFlash(color = '#fff', strength = 0.4) {
  flash.color  = color;
  flash.alpha  = strength;
}
function drawFlash() {
  if (flash.alpha <= 0) return;
  ctx.fillStyle = flash.color;
  ctx.globalAlpha = flash.alpha;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  flash.alpha -= 0.04;
}

// ─── Game state ───────────────────────────────────────────────────────────
const PLAYER_SPEED = 2.5; 
const PLAYER_R     = 12;

const player = {
  x: 1 * TILE + TILE / 2,
  y: 1 * TILE + TILE / 2,
  vx: 0, vy: 0,
  hp: 100, maxHp: 100,
  dir: 'right',
  flap: 0,
  invincible: 0,
  score: 0,
  wave: 1,
};

let orbs    = [];
let wraiths = [];
let gameOver = false;
let gameWon  = false;
let t = 0;
let waveStartTime = 0; // Tracks structural duration thresholds per wave reset

let targetX = null;
let targetY = null;
let bufferedInput = null; 

function validFloorPos() {
  let x, y, tx, ty;
  let attempts = 0;
  do {
    tx = randi(1, COLS - 1);
    ty = randi(1, ROWS - 1);
    x  = tx * TILE + TILE / 2;
    y  = ty * TILE + TILE / 2;
    attempts++;
  } while ((isSolid(tx, ty) || dist({ x, y }, player) < 140) && attempts < 200);
  return { x, y };
}

function spawnOrbs(n) {
  for (let i = 0; i < n; i++) {
    const pos = validFloorPos();
    orbs.push({ ...pos, color: '#facc15', phase: rand(0, Math.PI * 2), value: 10 });
  }
}

function spawnWraiths(n) {
  for (let i = 0; i < n; i++) {
    const pos = validFloorPos();
    wraiths.push({
      x: pos.x,
      y: pos.y,
      targetX: pos.x,
      targetY: pos.y,
      speed: 2.0, 
      phase: rand(0, Math.PI * 2),
      hp: 1,
    });
  }
}

function startWave(w) {
  player.wave = w;
  waveEl.textContent = w;

  generateRandomMaze();

  orbs    = [];
  wraiths = [];
  
  targetX = 1 * TILE + TILE / 2;
  targetY = 1 * TILE + TILE / 2;
  player.x = targetX;
  player.y = targetY;
  player.dir = 'right'; 
  
  spawnOrbs(5 + w * 2);
  spawnWraiths(2 + w * 2);
  triggerFlash('#a78bfa', 0.3);
  
  waveStartTime = t; // Calibrate system clocks on wave entry
}

startWave(1);

function circleVsMap(cx, cy, r) {
  const points = [
    [cx - r, cy - r], [cx + r, cy - r],
    [cx - r, cy + r], [cx + r, cy + r],
    [cx,     cy - r], [cx,     cy + r],
    [cx - r, cy    ], [cx + r, cy    ],
  ];
  for (const [px, py] of points) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (isSolid(tx, ty)) return true;
  }
  return false;
}

// ─── Update player ────────────────────────────────────────────────────────
function updatePlayer() {
  const left  = keys['ArrowLeft']  || keys['a'] || keys['A'];
  const right = keys['ArrowRight'] || keys['d'] || keys['D'];
  const up    = keys['ArrowUp']    || keys['w'] || keys['W'];
  const down  = keys['ArrowDown']  || keys['s'] || keys['S'];

  if (targetX === null) targetX = player.x;
  if (targetY === null) targetY = player.y;

  if (left)  bufferedInput = 'left';
  if (right) bufferedInput = 'right';
  if (up)    bufferedInput = 'up';
  if (down)  bufferedInput = 'down';

  if (player.x === targetX && player.y === targetY) {
    let dx = 0, dy = 0;
    let chosenDir = bufferedInput;

    if (!chosenDir) {
      if (left) chosenDir = 'left';
      else if (right) chosenDir = 'right';
      else if (up) chosenDir = 'up';
      else if (down) chosenDir = 'down';
    }

    if (chosenDir === 'left')  dx = -1;
    if (chosenDir === 'right') dx = 1;
    if (chosenDir === 'up')    dy = -1;
    if (chosenDir === 'down')  dy = 1;

    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      const nextTargetX = player.x + dx * TILE;
      const nextTargetY = player.y + dy * TILE;

      if (dx !== 0 && !circleVsMap(nextTargetX, player.y, PLAYER_R)) {
        targetX = nextTargetX;
        player.dir = chosenDir;
        bufferedInput = null; 
      } else if (dy !== 0 && !circleVsMap(player.x, nextTargetY, PLAYER_R)) {
        targetY = nextTargetY;
        player.dir = chosenDir;
        bufferedInput = null;
      } else {
        bufferedInput = null;
      }
    }
  }

  if (player.x !== targetX) {
    const stepX = Math.sign(targetX - player.x) * PLAYER_SPEED;
    if (Math.abs(targetX - player.x) <= PLAYER_SPEED) { player.x = targetX; } 
    else { player.x += stepX; player.flap += 1; }
  }
  if (player.y !== targetY) {
    const stepY = Math.sign(targetY - player.y) * PLAYER_SPEED;
    if (Math.abs(targetY - player.y) <= PLAYER_SPEED) { player.y = targetY; } 
    else { player.y += stepY; player.flap += 1; }
  }

  if (player.invincible > 0) player.invincible--;
}

// ─── Update wraiths ────────────────────────────────────────────────────────
function updateWraiths() {
  for (const w of wraiths) {
    if (w.x === w.targetX && w.y === w.targetY) {
      const currentTx = Math.floor(w.x / TILE);
      const currentTy = Math.floor(w.y / TILE);
      
      const playerTx = Math.floor(player.x / TILE);
      const playerTy = Math.floor(player.y / TILE);

      const options = [
        { tx: currentTx + 1, ty: currentTy },
        { tx: currentTx - 1, ty: currentTy },
        { tx: currentTx,     ty: currentTy + 1 },
        { tx: currentTx,     ty: currentTy - 1 }
      ];

      let bestOption = null;
      let minDistance = Infinity;

      for (const opt of options) {
        if (!isSolid(opt.tx, opt.ty)) {
          const d = Math.hypot(opt.tx - playerTx, opt.ty - playerTy);
          if (d < minDistance) {
            minDistance = d;
            bestOption = opt;
          }
        }
      }

      if (bestOption) {
        w.targetX = bestOption.tx * TILE + TILE / 2;
        w.targetY = bestOption.ty * TILE + TILE / 2;
      }
    }

    if (w.x !== w.targetX) {
      const stepX = Math.sign(w.targetX - w.x) * w.speed;
      if (Math.abs(w.targetX - w.x) <= w.speed) w.x = w.targetX;
      else w.x += stepX;
    }
    if (w.y !== w.targetY) {
      const stepY = Math.sign(w.targetY - w.y) * w.speed;
      if (Math.abs(w.targetY - w.y) <= w.speed) w.y = w.targetY;
      else w.y += stepY;
    }

    if (player.invincible === 0 && dist(w, player) < PLAYER_R + 14) {
      player.hp = Math.max(0, player.hp - 8);
      player.invincible = 60;
      triggerFlash('#dc2626', 0.4);
      hpEl.textContent = player.hp;
      if (player.hp <= 0) { gameOver = true; }
    }
  }
}

// ─── Collect orbs ────────────────────────────────────────────────────────
function collectOrbs() {
  for (let i = orbs.length - 1; i >= 0; i--) {
    if (dist(orbs[i], player) < PLAYER_R + 10) {
      spawnParticles(orbs[i].x, orbs[i].y, orbs[i].color, 12);
      player.score += orbs[i].value;
      scoreEl.textContent = player.score;
      orbs.splice(i, 1);
    }
  }
  if (orbs.length === 0 && !gameOver && !gameWon) {
    const next = player.wave + 1;
    if (next > 5) { gameWon = true; return; }
    startWave(next);
  }
}

// ─── Draw UI ──────────────────────────────────────────────────────────────
function drawHealthBar() {
  const barW = 160, barH = 12, bx = 10, by = 10;
  ctx.fillStyle = '#112211';
  ctx.fillRect(bx, by, barW, barH);
  const pct = player.hp / player.maxHp;
  const col = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#facc15' : '#f87171';
  ctx.fillStyle = col;
  ctx.fillRect(bx, by, barW * pct, barH);
  ctx.strokeStyle = '#143626';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, barW, barH);
}

function drawMiniMap() {
  const mw = 80, mh = 56, mx = W - mw - 8, my = 8;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(mx, my, mw, mh);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = MAP_TEMPLATE[r][c];
      if (cell === 1) ctx.fillStyle = '#40916c';
      else ctx.fillStyle = '#1b4332';
      ctx.fillRect(mx + c * (mw / COLS), my + r * (mh / ROWS), mw / COLS, mh / ROWS);
    }
  }
  const pdx = (player.x / (COLS * TILE)) * mw;
  const pdy = (player.y / (ROWS * TILE)) * mh;
  ctx.fillStyle = '#a78bfa';
  ctx.fillRect(mx + pdx - 1.5, my + pdy - 1.5, 3, 3);
  ctx.fillStyle = '#dc2626';
  for (const w of wraiths) {
    const wx = (w.x / (COLS * TILE)) * mw;
    const wy = (w.y / (ROWS * TILE)) * mh;
    ctx.fillRect(mx + wx - 1, my + wy - 1, 2, 2);
  }
  ctx.strokeStyle = '#2d6a4f';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx, my, mw, mh);
}

function drawOverlay(title, sub1, sub2) {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#a78bfa';
  ctx.font = 'bold 52px Segoe UI';
  ctx.fillText(title, W / 2, H / 2 - 40);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '22px Segoe UI';
  ctx.fillText(sub1, W / 2, H / 2 + 10);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px Segoe UI';
  ctx.fillText(sub2, W / 2, H / 2 + 44);
  ctx.textAlign = 'left';
}

function drawWaveAnnounce() {
  const elapsed = t - waveStartTime;
  // Strictly cuts out rendering after 5 seconds have elapsed from generation thresholds
  if (elapsed < 5.0) {
    let alpha = 1;
    // Elegant fade out calculation over the final 1 second of visibility
    if (elapsed > 4.0) {
      alpha = 1.0 - (elapsed - 4.0);
    }
    
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Segoe UI';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(`Wave ${player.wave}`, W / 2, H / 2 - 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '18px Segoe UI';
    ctx.fillText(`Collect all worms!`, W / 2, H / 2 + 24);
    ctx.restore();
    ctx.textAlign = 'left';
  }
}

// ─── Game Over / Won restart ──────────────────────────────────────────────
window.addEventListener('keydown', e => {
  if ((gameOver || gameWon) && e.key === 'Enter') {
    resetGame();
  }
});

function resetGame() {
  player.hp = 100;
  player.score = 0;
  player.invincible = 0;
  player.flap = 0;
  player.dir = 'right';
  bufferedInput = null;
  gameOver = false;
  gameWon  = false;
  hpEl.textContent    = 100;
  scoreEl.textContent = 0;
  particles.length    = 0;
  t = 0;
  startWave(1);
}

// ─── Main loop ────────────────────────────────────────────────────────────
function loop() {
  requestAnimationFrame(loop);

  t += 0.016;

  ctx.clearRect(0, 0, W, H);

  if (!gameOver && !gameWon) {
    updatePlayer();
    updateWraiths();
    collectOrbs();
    updateParticles();
  }

  updateCam(player.x, player.y);

  drawTiles();
  drawParticles();

  for (const o of orbs)    drawOrb(o, t);
  for (const w of wraiths) drawWraith(w, t);

  const blink = player.invincible > 0 && Math.floor(player.invincible / 6) % 2 === 0;
  if (!blink) {
    drawRaven(player.x - cam.x, player.y - cam.y, player.dir, player.flap, player.hp);
  }

  drawFlash();
  drawHealthBar();
  drawMiniMap();
  drawWaveAnnounce();

  if (gameOver) drawOverlay('☠ GAME OVER', `Score: ${player.score}`, 'Press Enter to restart');
  if (gameWon)  drawOverlay('✦ VICTORY ✦', `Final Score: ${player.score}`, 'Press Enter to play again');
}

loop();