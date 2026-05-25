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

// ─── Tile map ─────────────────────────────────────────────────────────────
const TILE   = 40;
const COLS   = W / TILE;   // 20
const ROWS   = H / TILE;   // 14

// 0 = floor, 1 = wall, 2 = water
const MAP_TEMPLATE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,1,1,0,1,0,1,1,1,1,0,1,0,1,1,0,0,1],
  [1,0,0,1,0,0,0,0,0,2,2,0,0,0,0,0,1,0,0,1],
  [1,0,0,0,0,0,1,0,0,2,2,0,0,1,0,0,0,0,0,1],
  [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
  [1,0,0,1,0,0,1,0,1,1,1,1,0,1,0,0,1,0,0,1],
  [1,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,1,0,0,2,2,0,0,1,0,0,0,0,0,1],
  [1,0,0,1,1,0,1,0,0,0,0,0,0,1,0,1,1,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

function isSolid(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  return MAP_TEMPLATE[ty][tx] === 1;
}
function isWater(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
  return MAP_TEMPLATE[ty][tx] === 2;
}

// ─── Camera ───────────────────────────────────────────────────────────────
const cam = { x: 0, y: 0 };
function updateCam(px, py) {
  cam.x = clamp(px - W / 2, 0, COLS * TILE - W);
  cam.y = clamp(py - H / 2, 0, ROWS * TILE - H);
  // World fits canvas exactly, so cam stays 0,0
  cam.x = 0; cam.y = 0;
}


// ─── Tilemap drawing ──────────────────────────────────────────────────────
const PALETTE = {
  floor: '#1a1a2e',
  floorLine: '#16213060',
  wall: '#312e81',
  wallTop: '#4338ca',
  water: '#1e3a5f',
  waterShine: '#38bdf8',
};

const waterAnim = { t: 0 };

function drawTiles() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * TILE - cam.x;
      const y = r * TILE - cam.y;
      const cell = MAP_TEMPLATE[r][c];

      // Check if this cell belongs to the border or the middle area
      const isBorder = (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1);

      if (cell === 1) {
        // Wall
        if (isBorder) {
          // Keep original wall structure for the border
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = PALETTE.wallTop;
          ctx.fillRect(x, y, TILE, 6);
          // subtle stone lines
          ctx.strokeStyle = '#1e1b4b';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x, y, TILE, TILE);
        } else {
          // Draw a jagged Mountain silhouette for the middle tiles
          // Base/Background floor color first so empty space isn't blank
          ctx.fillStyle = PALETTE.floor;
          ctx.fillRect(x, y, TILE, TILE);

          // Mountain Shaded Side (Darker Wall tone)
          ctx.fillStyle = PALETTE.wall;
          ctx.beginPath();
          ctx.moveTo(x + TILE / 2, y + 4);       // Peak
          ctx.lineTo(x + TILE, y + TILE);       // Bottom right
          ctx.lineTo(x, y + TILE);              // Bottom left
          ctx.closePath();
          ctx.fill();

          // Mountain Highlight Side (Lighter WallTop tone for a 3D lit ridge)
          ctx.fillStyle = PALETTE.wallTop;
          ctx.beginPath();
          ctx.moveTo(x + TILE / 2, y + 4);       // Peak
          ctx.lineTo(x + TILE / 2, y + TILE);   // Middle vertical baseline
          ctx.lineTo(x, y + TILE);              // Bottom left
          ctx.closePath();
          ctx.fill();

          // Snow Cap / Jagged Ridge detail
          ctx.strokeStyle = '#e0e7ff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + TILE / 2, y + 4);
          ctx.lineTo(x + TILE * 0.35, y + TILE * 0.4);
          ctx.lineTo(x + TILE * 0.5, y + TILE * 0.45);
          ctx.stroke();
        }
      } else if (cell === 2) {
        // Water
        ctx.fillStyle = PALETTE.water;
        ctx.fillRect(x, y, TILE, TILE);
        // animated ripple
        const ripple = Math.sin(waterAnim.t * 2 + c * 0.8 + r * 0.6) * 3;
        ctx.fillStyle = PALETTE.waterShine;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(x + 4, y + 14 + ripple, TILE - 8, 4);
        ctx.fillRect(x + 8, y + 24 + ripple * -1, TILE - 16, 3);
        ctx.globalAlpha = 1;
      } else {
        // Floor
        ctx.fillStyle = PALETTE.floor;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = PALETTE.floorLine;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, TILE, TILE);
      }
    }
  }
}

// ─── Raven sprite (drawn procedurally) ───────────────────────────────────
function drawRaven(x, y, dir, flap, hp) {
  ctx.save();
  ctx.translate(x, y);
  if (dir === 'left') ctx.scale(-1, 1);

  const flapOff = Math.sin(flap * 0.4) * 5;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 14, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wings (behind body)
  ctx.fillStyle = '#111';
  // Left wing
  ctx.beginPath();
  ctx.ellipse(-14, -2 + flapOff, 12, 6, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Right wing
  ctx.beginPath();
  ctx.ellipse(14, -2 - flapOff, 12, 6, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#0f0f0f';
  ctx.beginPath();
  ctx.ellipse(0, -13, 7, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eye
  const eyeGlow = 0.7 + Math.sin(flap * 0.1) * 0.3;
  ctx.fillStyle = `rgba(167, 139, 250, ${eyeGlow})`;
  ctx.beginPath();
  ctx.arc(3, -14, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(3.5, -14.5, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = '#4a4a4a';
  ctx.beginPath();
  ctx.moveTo(5, -13);
  ctx.lineTo(13, -11);
  ctx.lineTo(5, -10);
  ctx.closePath();
  ctx.fill();

  // Tail feathers
  ctx.fillStyle = '#0f0f0f';
  ctx.beginPath();
  ctx.moveTo(-5, 11);
  ctx.lineTo(-9, 20);
  ctx.lineTo(0, 16);
  ctx.lineTo(9, 20);
  ctx.lineTo(5, 11);
  ctx.closePath();
  ctx.fill();

  // Wing highlights
  ctx.strokeStyle = '#2a2a3a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6, -2 + flapOff);
  ctx.quadraticCurveTo(-14, 2 + flapOff, -22, 0 + flapOff);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(6, -2 - flapOff);
  ctx.quadraticCurveTo(14, 2 - flapOff, 22, 0 - flapOff);
  ctx.stroke();

  // Low HP red tint flicker
  if (hp < 30) {
    ctx.fillStyle = `rgba(220,38,38,${Math.sin(Date.now() * 0.01) * 0.3 + 0.1})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ─── Orb (collectible) ────────────────────────────────────────────────────
function drawOrb(orb, t) {
  const pulse = Math.sin(t * 3 + orb.phase) * 3;
  const r = 8 + pulse;
  ctx.save();
  ctx.translate(orb.x - cam.x, orb.y - cam.y);

  // Outer glow (Retained, but reshaped to follow the worm's squiggly path)
  ctx.save();
  ctx.lineWidth = r * 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = orb.color + '44'; // Semi-transparent glow
  ctx.beginPath();
  const segments = 4;
  for (let i = 0; i <= segments; i++) {
    // Maps a crawling horizontal worm from left to right (-r to +r)
    const segmentX = -r + (i * (r * 2)) / segments;
    // Wiggle effect based on time and segment index
    const segmentY = Math.sin(t * 6 + i + orb.phase) * (r * 0.4);
    if (i === 0) ctx.moveTo(segmentX, segmentY);
    else ctx.lineTo(segmentX, segmentY);
  }
  ctx.stroke();
  ctx.restore();

  // Core Worm Body
  ctx.lineWidth = r * 0.6; // Body thickness scales with the original radius
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = orb.color; // Uses the original orb color
  
  ctx.beginPath();
  const wormPts = [];
  for (let i = 0; i <= segments; i++) {
    const bx = -r + (i * (r * 2)) / segments;
    const by = Math.sin(t * 6 + i + orb.phase) * (r * 0.4);
    wormPts.push({x: bx, y: by});
    if (i === 0) ctx.moveTo(bx, by);
    else ctx.lineTo(bx, by);
  }
  ctx.stroke();

  // Tiny Cute Worm Eyes (drawn on the leading "head" segment)
  const head = wormPts[segments]; // Right side is the head
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(head.x - 1, head.y - 2, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(head.x - 1, head.y - 2, 0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── Wraith (enemy) ───────────────────────────────────────────────────────
function drawWraith(w, t) {
  ctx.save();
  ctx.translate(w.x - cam.x, w.y - cam.y);
  const bob = Math.sin(t * 4 + w.phase) * 3;
  ctx.translate(0, bob);

  // Glow (Aggressive red aura remains)
  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
  grd.addColorStop(0, 'rgba(33, 32, 32, 0.5)');
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();

  // Dynamic wing flap based on time
  const flap = Math.sin(t * 8 + w.phase) * 6;

  // Wings & Body (Eagle Shape)
  ctx.fillStyle = '#6f5737'; // Crimson/Dark body color retained
  ctx.beginPath();
  // Left Wing tip
  ctx.moveTo(-20, -4 + flap);
  // To shoulders / head base
  ctx.quadraticCurveTo(-10, -8, -6, -6);
  // Crown of the head
  ctx.lineTo(-4, -14);
  ctx.lineTo(4, -14);
  // Back of head to right shoulder
  ctx.lineTo(6, -6);
  // Right Wing tip
  ctx.quadraticCurveTo(10, -8, 20, -4 + flap);
  // Right wing underbelly
  ctx.lineTo(10, 4 + flap);
  // Tail feathers
  ctx.lineTo(4, 12);
  ctx.lineTo(-4, 12);
  // Left wing underbelly
  ctx.lineTo(-10, 4 + flap);
  ctx.closePath();
  ctx.fill();

  // Eagle Beak (Golden/Yellow predatory hook)
  ctx.fillStyle = '#f10e0e';
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(5, -6);
  ctx.lineTo(0, -2);
  ctx.lineTo(-2, -6);
  ctx.closePath();
  ctx.fill();

  // Piercing Eyes
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
const PLAYER_SPEED = 2.8;
const PLAYER_R     = 12;

const player = {
  x: 3 * TILE + TILE / 2,
  y: 2 * TILE + TILE / 2,
  vx: 0, vy: 0,
  hp: 100, maxHp: 100,
  dir: 'right',
  flap: 0,
  invincible: 0,   // frames of i-frames after hit
  score: 0,
  wave: 1,
};

let orbs    = [];
let wraiths = [];
let gameOver = false;
let gameWon  = false;
let t = 0;

// ─── Spawn helpers ────────────────────────────────────────────────────────
function validFloorPos() {
  let x, y, tx, ty;
  do {
    tx = randi(1, COLS - 1);
    ty = randi(1, ROWS - 1);
    x  = tx * TILE + TILE / 2;
    y  = ty * TILE + TILE / 2;
  } while (isSolid(tx, ty) || isWater(tx, ty) || dist({ x, y }, player) < 120);
  return { x, y };
}

const ORB_COLORS = ['#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#60a5fa'];

function spawnOrbs(n) {
  for (let i = 0; i < n; i++) {
    const pos = validFloorPos();
    orbs.push({ ...pos, color: ORB_COLORS[randi(0, ORB_COLORS.length)], phase: rand(0, Math.PI * 2), value: 10 });
  }
}

function spawnWraiths(n) {
  for (let i = 0; i < n; i++) {
    const pos = validFloorPos();
    wraiths.push({
      ...pos,
      speed: rand(0.8, 1.4 + player.wave * 0.15),
      phase: rand(0, Math.PI * 2),
      hp: 1,
    });
  }
}

function startWave(w) {
  player.wave = w;
  waveEl.textContent = w;
  orbs    = [];
  wraiths = [];
  spawnOrbs(5 + w * 2);
  spawnWraiths(2 + w * 2);
  triggerFlash('#a78bfa', 0.3);
}

startWave(1);

// ─── Collision helpers ────────────────────────────────────────────────────
function circleVsMap(cx, cy, r) {
  // Check corners of bounding box
  const points = [
    [cx - r, cy - r], [cx + r, cy - r],
    [cx - r, cy + r], [cx + r, cy + r],
    [cx,     cy - r], [cx,     cy + r],
    [cx - r, cy    ], [cx + r, cy    ],
  ];
  for (const [px, py] of points) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (isSolid(tx, ty) || isWater(tx, ty)) return true;
  }
  return false;
}

// Track the exact pixel destination the raven is currently gliding toward
let targetX = null;
let targetY = null;

// ─── Update player ────────────────────────────────────────────────────────
function updatePlayer() {
  const left  = keys['ArrowLeft']  || keys['a'] || keys['A'];
  const right = keys['ArrowRight'] || keys['d'] || keys['D'];
  const up    = keys['ArrowUp']    || keys['w'] || keys['W'];
  const down  = keys['ArrowDown']  || keys['s'] || keys['S'];

  // Initialize targets if this is the very first frame of the game
  if (targetX === null) targetX = player.x;
  if (targetY === null) targetY = player.y;

  // 1. INPUT PHASE: Only look for keys if the raven has reached its target tile
  if (player.x === targetX && player.y === targetY) {
    let dx = 0, dy = 0;
    if (left)  dx -= 1;
    if (right) dx += 1;
    // Prioritize horizontal movement, or swap if you prefer vertical
    if (dx === 0) {
      if (up)   dy -= 1;
      if (down) dy += 1;
    }

    // Normalise diagonal (Kept for compatibility)
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      player.flap += 1;
      if (dx > 0) player.dir = 'right';
      if (dx < 0) player.dir = 'left';

      // Calculate the next tile position
      const nextTargetX = player.x + dx * TILE;
      const nextTargetY = player.y + dy * TILE;

      // Check collision before committing to the new tile target
      if (dx !== 0 && !circleVsMap(nextTargetX, player.y, PLAYER_R)) {
        targetX = nextTargetX;
      }
      if (dy !== 0 && !circleVsMap(player.x, nextTargetY, PLAYER_R)) {
        targetY = nextTargetY;
      }
    }
  }

  // 2. MOVEMENT PHASE: Actively step toward the target tile using PLAYER_SPEED
  if (player.x !== targetX) {
    const stepX = Math.sign(targetX - player.x) * PLAYER_SPEED;
    // Prevent overshooting the tile if speed doesn't divide perfectly
    if (Math.abs(targetX - player.x) <= PLAYER_SPEED) {
      player.x = targetX;
    } else {
      player.x += stepX;
    }
  }

  if (player.y !== targetY) {
    const stepY = Math.sign(targetY - player.y) * PLAYER_SPEED;
    if (Math.abs(targetY - player.y) <= PLAYER_SPEED) {
      player.y = targetY;
    } else {
      player.y += stepY;
    }
  }

  if (player.invincible > 0) player.invincible--;
}

// ─── Update wraiths ───────────────────────────────────────────────────────
function updateWraiths() {
  for (const w of wraiths) {
    const angle = Math.atan2(player.y - w.y, player.x - w.x);
    // Wander slightly
    const wander = Math.sin(t * 2 + w.phase) * 0.3;
    const nx = w.x + Math.cos(angle + wander) * w.speed;
    const ny = w.y + Math.sin(angle + wander) * w.speed;
    const tx = Math.floor(nx / TILE);
    const ty = Math.floor(ny / TILE);
    if (!isSolid(tx, ty) && !isWater(tx, ty)) {
      w.x = nx; w.y = ny;
    }

    // Hit player
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
  // All orbs collected → next wave
  if (orbs.length === 0 && !gameOver && !gameWon) {
    const next = player.wave + 1;
    if (next > 5) { gameWon = true; return; }
    startWave(next);
  }
}

// ─── Draw UI ──────────────────────────────────────────────────────────────
function drawHealthBar() {
  const barW = 160, barH = 12, bx = 10, by = 10;
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(bx, by, barW, barH);
  const pct = player.hp / player.maxHp;
  const col = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#facc15' : '#f87171';
  ctx.fillStyle = col;
  ctx.fillRect(bx, by, barW * pct, barH);
  ctx.strokeStyle = '#312e81';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, barW, barH);
}

function drawMiniMap() {
  const mw = 80, mh = 56, mx = W - mw - 8, my = 8;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(mx, my, mw, mh);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = MAP_TEMPLATE[r][c];
      if (cell === 1) ctx.fillStyle = '#312e81';
      else if (cell === 2) ctx.fillStyle = '#1e40af';
      else ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(mx + c * (mw / COLS), my + r * (mh / ROWS), mw / COLS, mh / ROWS);
    }
  }
  // Player dot
  const pdx = (player.x / (COLS * TILE)) * mw;
  const pdy = (player.y / (ROWS * TILE)) * mh;
  ctx.fillStyle = '#a78bfa';
  ctx.fillRect(mx + pdx - 1.5, my + pdy - 1.5, 3, 3);
  // Wraith dots
  ctx.fillStyle = '#dc2626';
  for (const w of wraiths) {
    const wx = (w.x / (COLS * TILE)) * mw;
    const wy = (w.y / (ROWS * TILE)) * mh;
    ctx.fillRect(mx + wx - 1, my + wy - 1, 2, 2);
  }
  ctx.strokeStyle = '#4338ca';
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
  if (t < 120) {
    const alpha = t < 60 ? t / 60 : (120 - t) / 60;
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 36px Segoe UI';
    ctx.fillText(`Wave ${player.wave}`, W / 2, H / 2 - 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '18px Segoe UI';
    ctx.fillText(`Collect all orbs!`, W / 2, H / 2 + 24);
    ctx.globalAlpha = 1;
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
  player.x = 3 * TILE + TILE / 2;
  player.y = 2 * TILE + TILE / 2;
  player.hp = 100;
  player.score = 0;
  player.invincible = 0;
  player.flap = 0;
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
  waterAnim.t = t;

  // Clear
  ctx.clearRect(0, 0, W, H);

  drawTiles();
  drawParticles();

  if (!gameOver && !gameWon) {
    updatePlayer();
    updateWraiths();
    collectOrbs();
    updateParticles();
  }

  // Draw orbs
  for (const o of orbs)    drawOrb(o, t);
  // Draw wraiths
  for (const w of wraiths) drawWraith(w, t);

  // Draw raven (blink during i-frames)
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
