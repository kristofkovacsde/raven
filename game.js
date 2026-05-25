// ─── Raven's Quest ───────────────────────────────────────────────────────────
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const hpEl    = document.getElementById('hp');
const scoreEl = document.getElementById('score');
const waveEl  = document.getElementById('wave');

// ─── Input ────────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => {
  bootAudio();
  keys[e.key] = true;
  if (e.key.startsWith('Arrow') || ['w','a','s','d','W','A','S','D','Enter'].includes(e.key)) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

const joyInput = {
  active: false,
  origin: { x: 0, y: 0 },
  current: { x: 0, y: 0 },
  dx: 0,
  dy: 0,
  strength: 0,
};

function setupTouchpad() {
  const pad = document.getElementById('touchpad');
  const base = document.getElementById('touch-base');
  const thumb = document.getElementById('touch-thumb');
  const maxRadius = 72;

  const setPosition = (el, x, y) => {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  };

  const beginTouch = (x, y) => {
    if (x > window.innerWidth * 0.5) return;
    joyInput.active = true;
    joyInput.origin = { x, y };
    joyInput.current = { x, y };
    joyInput.dx = 0;
    joyInput.dy = 0;
    joyInput.strength = 0;
    pad.classList.add('active');
    setPosition(base, x, y);
    setPosition(thumb, x, y);
  };

  const updateTouch = (x, y) => {
    if (!joyInput.active) return;
    const dx = x - joyInput.origin.x;
    const dy = y - joyInput.origin.y;
    const distance = Math.hypot(dx, dy);
    const clipped = Math.min(distance, maxRadius);
    const angle = Math.atan2(dy, dx);
    const tx = joyInput.origin.x + Math.cos(angle) * clipped;
    const ty = joyInput.origin.y + Math.sin(angle) * clipped;

    joyInput.current = { x: tx, y: ty };
    joyInput.dx = clipped > 6 ? Math.cos(angle) : 0;
    joyInput.dy = clipped > 6 ? Math.sin(angle) : 0;
    joyInput.strength = clamp(clipped / maxRadius, 0, 1);
    setPosition(thumb, tx, ty);
  };

  const endTouch = () => {
    joyInput.active = false;
    joyInput.dx = 0;
    joyInput.dy = 0;
    joyInput.strength = 0;
    pad.classList.remove('active');
  };

  window.addEventListener('touchstart', event => {
    const touch = event.touches[0];
    if (!touch) return;
    beginTouch(touch.clientX, touch.clientY);
    event.preventDefault();
  }, { passive: false });

  window.addEventListener('touchmove', event => {
    const touch = event.touches[0];
    if (!touch) return;
    updateTouch(touch.clientX, touch.clientY);
    event.preventDefault();
  }, { passive: false });

  window.addEventListener('touchend', event => {
    if (event.touches.length === 0) endTouch();
  });
  window.addEventListener('touchcancel', endTouch);
}
setupTouchpad();

// ─── Audio ────────────────────────────────────────────────────────────────
let AC = null, masterVol, musicVol, sfxVol;
let muted = false, gameOverSfxPlayed = false, gameWonSfxPlayed = false;

function bootAudio() {
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  masterVol = AC.createGain(); masterVol.gain.value = 0.7; masterVol.connect(AC.destination);
  musicVol  = AC.createGain(); musicVol.gain.value  = 0.38; musicVol.connect(masterVol);
  sfxVol    = AC.createGain(); sfxVol.gain.value    = 0.65; sfxVol.connect(masterVol);
  buildAmbience();
}
function toggleMute() {
  muted = !muted;
  if (masterVol) masterVol.gain.value = muted ? 0 : 0.7;
  const btn = document.getElementById('mute-btn');
  if (btn) { btn.textContent = muted ? '🔇' : '♪'; btn.classList.toggle('muted', muted); }
}
function buildAmbience() {
  const now = AC.currentTime;
  const sub = AC.createOscillator(); const sg = AC.createGain();
  sub.type = 'sine'; sub.frequency.value = 55; sg.gain.value = 0.10;
  sub.connect(sg); sg.connect(musicVol); sub.start(now);
  const flt = AC.createBiquadFilter();
  flt.type = 'lowpass'; flt.frequency.value = 350; flt.Q.value = 1.5; flt.connect(musicVol);
  [-5, 0, 7].forEach(d => {
    const o = AC.createOscillator(); const g = AC.createGain();
    o.type = 'sawtooth'; o.frequency.value = 110; o.detune.value = d; g.gain.value = 0.018;
    o.connect(g); g.connect(flt); o.start(now);
  });
  const lfo = AC.createOscillator(); const lg = AC.createGain();
  lfo.frequency.value = 0.08; lg.gain.value = 120;
  lfo.connect(lg); lg.connect(flt.frequency); lfo.start(now);
  const mid = AC.createOscillator(); const mg = AC.createGain();
  const trem = AC.createOscillator(); const tg = AC.createGain();
  mid.type = 'triangle'; mid.frequency.value = 165; mg.gain.value = 0;
  trem.frequency.value = 0.25; tg.gain.value = 0.022;
  trem.connect(tg); tg.connect(mg.gain); mid.connect(mg); mg.connect(musicVol);
  mid.start(now); trem.start(now);
  scheduleBells();
}
const PENTA = [220, 261.6, 293.7, 329.6, 392.0];
function scheduleBells() {
  if (!AC) return;
  const now = AC.currentTime;
  const freq = PENTA[Math.floor(Math.random() * PENTA.length)] * (Math.random() < 0.25 ? 2 : 1);
  const o = AC.createOscillator(); const e = AC.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  e.gain.setValueAtTime(0, now); e.gain.linearRampToValueAtTime(0.055, now + 0.015);
  e.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
  o.connect(e); e.connect(musicVol);
  const rvb = makeReverb(1.4); if (rvb) { e.connect(rvb); rvb.connect(musicVol); }
  o.start(now); o.stop(now + 2.2);
  setTimeout(scheduleBells, 1400 + Math.random() * 3200);
}
function makeReverb(dur) {
  if (!AC) return null;
  const len = Math.floor(AC.sampleRate * dur);
  const buf = AC.createBuffer(2, len, AC.sampleRate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1)*Math.pow(1-i/len,2); }
  const cv = AC.createConvolver(); cv.buffer = buf;
  const g = AC.createGain(); g.gain.value = 0.16; cv.connect(g); return g;
}
function _tone(freqs, type, vol, gap, hold) {
  if (!AC) return; const now = AC.currentTime;
  freqs.forEach((f, i) => {
    const o = AC.createOscillator(); const e = AC.createGain();
    o.type = type; o.frequency.value = f;
    e.gain.setValueAtTime(0, now+i*gap); e.gain.linearRampToValueAtTime(vol, now+i*gap+0.04);
    e.gain.exponentialRampToValueAtTime(0.0001, now+i*gap+hold);
    o.connect(e); e.connect(sfxVol); o.start(now+i*gap); o.stop(now+i*gap+hold+0.05);
  });
}
function sfxCollect() {
  if (!AC) return; const now = AC.currentTime;
  [[660,1320,'sine',0.28,0,0.22],[1980,2640,'triangle',0.10,0.05,0.22]].forEach(([f0,f1,tp,vol,d,dur]) => {
    const o=AC.createOscillator(); const e=AC.createGain(); o.type=tp;
    o.frequency.setValueAtTime(f0,now+d); o.frequency.exponentialRampToValueAtTime(f1,now+d+dur-0.05);
    e.gain.setValueAtTime(vol,now+d); e.gain.exponentialRampToValueAtTime(0.0001,now+d+dur);
    o.connect(e); e.connect(sfxVol); o.start(now+d); o.stop(now+d+dur);
  });
}
function sfxHit() {
  if (!AC) return; const now = AC.currentTime;
  const o=AC.createOscillator(); const eg=AC.createGain(); o.type='sine';
  o.frequency.setValueAtTime(100,now); o.frequency.exponentialRampToValueAtTime(35,now+0.12);
  eg.gain.setValueAtTime(0.45,now); eg.gain.exponentialRampToValueAtTime(0.0001,now+0.14);
  o.connect(eg); eg.connect(sfxVol); o.start(now); o.stop(now+0.15);
  const bLen=Math.floor(AC.sampleRate*0.08), buf=AC.createBuffer(1,bLen,AC.sampleRate);
  const d=buf.getChannelData(0); for(let i=0;i<bLen;i++) d[i]=Math.random()*2-1;
  const src=AC.createBufferSource(), nf=AC.createBiquadFilter(), ng=AC.createGain();
  src.buffer=buf; nf.type='bandpass'; nf.frequency.value=180; nf.Q.value=0.8;
  ng.gain.setValueAtTime(0.30,now); ng.gain.exponentialRampToValueAtTime(0.0001,now+0.10);
  src.connect(nf); nf.connect(ng); ng.connect(sfxVol); src.start(now);
}
function sfxHeal()   { _tone([523.3,659.3,784],   'sine',     0.15, 0.08, 0.55); }
function sfxPowerUp(){ _tone([330,415,494,659,784,988], 'triangle', 0.12, 0.06, 0.80); }
function sfxWave()   { _tone([220,277.2,329.6,440], 'triangle', 0.14, 0.11, 1.1); }
function sfxGameOver(){ _tone([440,330,220,110],  'sawtooth', 0.16, 0.22, 0.7); }
function sfxVictory() { _tone([261.6,329.6,392,523.3,659.3,784,1046.5],'triangle',0.12,0.09,1.5); }

// ─── Utility ──────────────────────────────────────────────────────────────
const rand  = (a,b) => Math.random()*(b-a)+a;
const randi = (a,b) => Math.floor(rand(a,b));
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const dist  = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
const lerp  = (a,b,f) => a + (b-a) * f;
function lerpAngle(cur, tgt, f) {
  let d = tgt-cur; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2; return cur+d*f;
}

// ─── Tile map ─────────────────────────────────────────────────────────────
const TILE=40, COLS=40, ROWS=28;
let MAP=[];
function generateMap() {
  MAP=[];
  for(let r=0;r<ROWS;r++) MAP.push(new Array(COLS).fill(0));
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++)
    if(r===0||r===ROWS-1||c===0||c===COLS-1) MAP[r][c]=1;

  const patchCount = 8;
  for(let p=0;p<patchCount;p++){
    const cx = randi(4,COLS-5);
    const cy = randi(4,ROWS-5);
    const radius = randi(2,4);
    for(let dy=-radius; dy<=radius; dy++) for(let dx=-radius; dx<=radius; dx++) {
      const rr = Math.hypot(dx,dy);
      if(rr <= radius + rand(-0.35,0.35) && cy+dy>1 && cy+dy<ROWS-1 && cx+dx>1 && cx+dx<COLS-1) {
        MAP[cy+dy][cx+dx] = 1;
      }
    }
  }

  for(let r=1;r<=3;r++) for(let c=1;c<=3;c++) MAP[r][c]=0;
}
function isSolid(tx,ty) {
  if(tx<0||ty<0||tx>=COLS||ty>=ROWS) return true;
  return MAP[ty][tx]===1;
}

// ─── Camera + shake ───────────────────────────────────────────────────────
const cam={x:0,y:0};
function updateCam(px,py) { cam.x=clamp(px-W/2,0,COLS*TILE-W); cam.y=clamp(py-H/2,0,ROWS*TILE-H); }
const shake={x:0,y:0,mag:0};
function triggerShake(mag=8) { shake.mag=Math.max(shake.mag,mag); }
function updateShake() {
  if(shake.mag>0.1){shake.x=(Math.random()-0.5)*shake.mag;shake.y=(Math.random()-0.5)*shake.mag;shake.mag*=0.82;}
  else{shake.x=0;shake.y=0;shake.mag=0;}
}

// ─── Tilemap ──────────────────────────────────────────────────────────────
const GRASS=['#2d7a3e','#317544','#265f32','#338848'];
const PAL={ border:'#0a2210', borderCap:'#1e5c30', hillGrass:'#40916c',
            rock:'#7a5535', rockLit:'#9b7048', snow:'#eeeeff', floorLine:'#1a5228' };

function drawTiles() {
  const sc=Math.max(0,Math.floor(cam.x/TILE)), ec=Math.min(COLS,Math.ceil((cam.x+W)/TILE));
  const sr=Math.max(0,Math.floor(cam.y/TILE)), er=Math.min(ROWS,Math.ceil((cam.y+H)/TILE));
  for(let r=sr;r<er;r++) for(let c=sc;c<ec;c++) {
    const x=c*TILE-cam.x, y=r*TILE-cam.y, cell=MAP[r][c];
    const border=r===0||r===ROWS-1||c===0||c===COLS-1;
    if(cell===1) {
      if(border) {
        ctx.fillStyle=PAL.border; ctx.fillRect(x,y,TILE,TILE);
        ctx.fillStyle=PAL.borderCap; ctx.fillRect(x,y,TILE,5);
        ctx.strokeStyle='#061409'; ctx.lineWidth=0.5; ctx.strokeRect(x,y,TILE,TILE);
      } else {
        ctx.fillStyle=PAL.hillGrass; ctx.fillRect(x,y,TILE,TILE);
        ctx.beginPath(); ctx.moveTo(x+TILE/2,y+12); ctx.lineTo(x+TILE,y+TILE); ctx.lineTo(x,y+TILE); ctx.closePath(); ctx.fill();
        ctx.fillStyle=PAL.rock;
        ctx.beginPath(); ctx.moveTo(x+TILE/2,y+4); ctx.lineTo(x+TILE*.88,y+TILE*.92); ctx.lineTo(x+TILE*.12,y+TILE*.92); ctx.closePath(); ctx.fill();
        ctx.fillStyle=PAL.rockLit;
        ctx.beginPath(); ctx.moveTo(x+TILE/2,y+4); ctx.lineTo(x+TILE*.88,y+TILE*.92); ctx.lineTo(x+TILE/2,y+TILE*.92); ctx.closePath(); ctx.fill();
        ctx.fillStyle=PAL.snow;
        ctx.beginPath(); ctx.moveTo(x+TILE/2,y+4); ctx.lineTo(x+TILE*.62,y+15); ctx.lineTo(x+TILE/2,y+13); ctx.lineTo(x+TILE*.38,y+15); ctx.closePath(); ctx.fill();
      }
    } else {
      ctx.fillStyle=GRASS[(r*7+c*13)%4]; ctx.fillRect(x,y,TILE,TILE);
      ctx.strokeStyle=PAL.floorLine; ctx.globalAlpha=0.18; ctx.lineWidth=0.5; ctx.strokeRect(x,y,TILE,TILE); ctx.globalAlpha=1;
    }
  }
}

// ─── Raven ────────────────────────────────────────────────────────────────
function drawRaven(x,y,dir,flap,hp) {
  ctx.save(); ctx.translate(x,y);
  if (typeof dir === 'number') ctx.rotate(dir);
  else if(dir==='left') ctx.scale(-1,1);
  else if(dir==='up')   ctx.rotate(-Math.PI/2);
  else if(dir==='down') ctx.rotate( Math.PI/2);
  const fo=Math.sin(flap*0.4)*5, immune=hasWalnutImmunity();
  if(immune) {
    const p=Math.sin(t*8)*0.3+0.7;
    ctx.shadowColor='#fbbf24'; ctx.shadowBlur=18*p;
    ctx.strokeStyle=`rgba(251,191,36,${p*.85})`; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.stroke(); ctx.shadowBlur=0;
  }
  const aura=ctx.createRadialGradient(0,0,0,0,0,28);
  aura.addColorStop(0,immune?'rgba(251,191,36,0.22)':'rgba(109,73,216,0.28)'); aura.addColorStop(1,'transparent');
  ctx.fillStyle=aura; ctx.beginPath(); ctx.arc(0,0,28,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(0,0,0,0.20)'; ctx.beginPath(); ctx.ellipse(0,22,14,6,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#0e0e1e';
  ctx.beginPath(); ctx.ellipse(-14,-2+fo,14,7,-0.2,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 14,-2-fo,14,7, 0.2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#18182e'; ctx.beginPath(); ctx.ellipse(0,0,10,14,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#0f0f1e'; ctx.beginPath(); ctx.ellipse(12,0,7,6.5,0,0,Math.PI*2); ctx.fill();
  const eg=0.7+Math.sin(flap*0.1)*0.3;
  ctx.shadowColor='rgba(167,139,250,0.9)'; ctx.shadowBlur=7;
  ctx.fillStyle=`rgba(167,139,250,${eg})`; ctx.beginPath(); ctx.arc(13,-3,2,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(14,-3.5,0.7,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#5a5a6a'; ctx.beginPath(); ctx.moveTo(18,-2); ctx.lineTo(26,0); ctx.lineTo(18,2); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#0f0f1e';
  ctx.beginPath(); ctx.moveTo(-11,-4); ctx.lineTo(-22,-7); ctx.lineTo(-18,0); ctx.lineTo(-22,7); ctx.lineTo(-11,4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(109,73,216,0.45)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(-4,-2+fo); ctx.quadraticCurveTo(-14,3+fo,-24,0+fo); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( 4,-2-fo); ctx.quadraticCurveTo( 14,3-fo, 24,0-fo); ctx.stroke();
  if(hp<30){ctx.fillStyle=`rgba(220,38,38,${Math.sin(Date.now()*.01)*.3+.1})`;ctx.beginPath();ctx.ellipse(0,0,10,14,0,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}

// ─── Eagle (enemy) ────────────────────────────────────────────────────────
// Drawn facing +x (right). Rotated by eagle.drawAngle each frame to face movement direction.
function drawEagle(eagle, t) {
  ctx.save();
  ctx.translate(eagle.x - cam.x, eagle.y - cam.y);
  ctx.rotate(eagle.drawAngle);

  const speed = Math.hypot(eagle.vx, eagle.vy);
  const flap = eagle.flap || Math.sin(t * 5 + eagle.phase);
  const wingBend = Math.sin(flap * 2.1) * 4;
  const sweep = 0.42 + Math.abs(flap) * 0.16 + clamp(speed * 0.06, 0, 0.24);
  const baseSpan = 28 + clamp(speed * 5.2, 0, 14);
  const verticalFlow = Math.sin(t * 3.3 + eagle.phase * 1.4) * 5.4;
  const tipPitch = 16 + Math.abs(flap) * 9;
  const rootY = wingBend * 0.65;

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(2, 9, 30 + speed * 1.2, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  const coreTone = '#4e3420';
  const covertTone = '#8c6239';
  const highlightTone = '#d6b16f';
  const primaryTone = '#2a160b';

  [-1, 1].forEach(sign => {
    const rootX = -3;
    const rootOffsetY = sign * rootY;
    const wingTipX = rootX + baseSpan + tipPitch * 0.8;
    const wingTipY = sign * (baseSpan * 0.35 + verticalFlow * 0.9) + rootOffsetY * 0.45;
    const midX = rootX + baseSpan * 0.4 + Math.cos(flap * 1.1) * 8;
    const midY = sign * (baseSpan * 0.22 + Math.sin(t * 3 + eagle.phase) * 6) + rootOffsetY * 0.25;

    ctx.fillStyle = coreTone;
    ctx.beginPath();
    ctx.moveTo(rootX, rootOffsetY);
    ctx.bezierCurveTo(rootX + 10, sign * 8, midX, midY, wingTipX, wingTipY);
    ctx.lineTo(wingTipX - 4, wingTipY + sign * 6);
    ctx.quadraticCurveTo(rootX + 12, sign * 22, rootX + 8, sign * 18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = covertTone;
    ctx.beginPath();
    ctx.moveTo(rootX + 2, sign * 2);
    ctx.quadraticCurveTo(rootX + baseSpan * 0.18, sign * (baseSpan * 0.18), wingTipX - 8, wingTipY * 0.72);
    ctx.lineTo(wingTipX - 8, wingTipY + sign * 4);
    ctx.lineTo(rootX + 8, sign * 16);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = highlightTone;
    ctx.beginPath();
    ctx.moveTo(rootX + 4, sign * 2);
    ctx.quadraticCurveTo(rootX + baseSpan * 0.1, sign * (baseSpan * 0.12), rootX + baseSpan * 0.24, sign * (baseSpan * 0.42));
    ctx.lineTo(rootX + 6, sign * 6);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < 7; i++) {
      const step = i / 6;
      const fLen = 11 + step * 14 + Math.abs(flap) * 1.8;
      const fBaseX = rootX + baseSpan * 0.44 + step * 11;
      const fBaseY = sign * (baseSpan * 0.18 + step * 12);
      const fTipX = fBaseX + fLen * 0.62;
      const fTipY = fBaseY + sign * (7 + step * 6);
      ctx.fillStyle = i % 2 === 0 ? primaryTone : '#3d2311';
      ctx.beginPath();
      ctx.moveTo(fBaseX, fBaseY);
      ctx.quadraticCurveTo(fBaseX + fLen * 0.22, fBaseY + sign * (fLen * 0.24), fTipX, fTipY);
      ctx.lineTo(fTipX - 4, fTipY - sign * 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.24)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(fBaseX + 1, fBaseY + sign * 1);
      ctx.lineTo(fTipX - 3, fTipY - sign * 1.5);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(18,10,6,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rootX, rootOffsetY);
    ctx.quadraticCurveTo(rootX + 12, sign * 9, midX, midY);
    ctx.lineTo(wingTipX, wingTipY);
    ctx.stroke();
  });

  ctx.fillStyle = '#402814';
  ctx.beginPath(); ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = highlightTone;
  ctx.beginPath(); ctx.ellipse(4, 0, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#f2edde';
  ctx.beginPath(); ctx.ellipse(18, 0, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#130a03';
  ctx.beginPath(); ctx.arc(18, -1.6, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(19, -2.1, 0.5, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#e1a22e';
  ctx.beginPath();
  ctx.moveTo(23, -1.8);
  ctx.lineTo(31, -1.2);
  ctx.quadraticCurveTo(34, 1.6, 29.2, 3.8);
  ctx.lineTo(23, 2.2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f5ca4b';
  ctx.beginPath();
  ctx.moveTo(23, -1.8);
  ctx.lineTo(30.2, -1.2);
  ctx.lineTo(28.2, 0.8);
  ctx.lineTo(23.1, -0.4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#b7700f';
  ctx.beginPath();
  ctx.moveTo(27.5, 0.9);
  ctx.quadraticCurveTo(31, 1.8, 28.8, 4.0);
  ctx.lineTo(27.2, 3.2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2c1809';
  ctx.beginPath();
  ctx.moveTo(-10, -5);
  ctx.lineTo(-26, -8);
  ctx.lineTo(-23, 0);
  ctx.lineTo(-26, 8);
  ctx.lineTo(-10, 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ─── Earthworm (collectable) ──────────────────────────────────────────────
function drawOrb(orb, t) {
  const HALFLEN = 12, SEGS = 9;
  const bodyR = 6.5 + Math.sin(t*3+orb.phase)*0.8;
  ctx.save();
  ctx.translate(orb.x-cam.x, orb.y-cam.y);

  // Earthy glow halo
  const grd=ctx.createRadialGradient(0,0,0,0,0,bodyR*2.8);
  grd.addColorStop(0,'rgba(110,55,15,0.22)'); grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,0,bodyR*2.8,0,Math.PI*2); ctx.fill();

  // Build worm path
  const pts=[];
  for(let i=0;i<=SEGS;i++) {
    const bx=-HALFLEN+(i*HALFLEN*2)/SEGS;
    const by=Math.sin(t*6+i*0.85+orb.phase)*(bodyR*.44);
    pts.push({x:bx, y:by});
  }

  // Outer glow stroke (earthy brown)
  ctx.save();
  ctx.lineWidth=bodyR*2.7; ctx.lineCap='round'; ctx.strokeStyle='rgba(80,35,8,0.20)';
  ctx.beginPath(); pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();
  ctx.restore();

  // Draw each segment as a rotated ellipse
  for(let i=0;i<SEGS;i++) {
    const p0=pts[i], p1=pts[i+1];
    const cx=(p0.x+p1.x)/2, cy=(p0.y+p1.y)/2;
    const ang=Math.atan2(p1.y-p0.y, p1.x-p0.x);
    const sLen=Math.hypot(p1.x-p0.x,p1.y-p0.y)*0.56+0.8;
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(ang);
    // Alternating saddle-brown segments
    ctx.fillStyle = i%2===0 ? '#8B4513' : '#7a3a0e';
    ctx.beginPath(); ctx.ellipse(0,0,sLen,bodyR,0,0,Math.PI*2); ctx.fill();
    // Belly highlight
    ctx.fillStyle='rgba(185,110,65,0.28)';
    ctx.beginPath(); ctx.ellipse(0,-bodyR*.3,sLen*.65,bodyR*.38,0,0,Math.PI*2); ctx.fill();
    // Ring groove
    ctx.strokeStyle='#5c2a08'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(-sLen,0); ctx.lineTo(sLen,0); ctx.stroke();
    ctx.restore();
  }

  // Head — pinkish-red, slightly enlarged
  const head=pts[SEGS], prev=pts[SEGS-1];
  const headAng=Math.atan2(head.y-prev.y, head.x-prev.x);
  ctx.save(); ctx.translate(head.x,head.y); ctx.rotate(headAng);
  ctx.fillStyle='#c0392b';
  ctx.beginPath(); ctx.ellipse(bodyR*.6,0,bodyR*1.2,bodyR*1.05,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(220,120,100,0.40)';
  ctx.beginPath(); ctx.ellipse(bodyR*.4,-bodyR*.3,bodyR*.6,bodyR*.5,0,0,Math.PI*2); ctx.fill();
  // Eyes
  ctx.fillStyle='#1a0000';
  ctx.beginPath(); ctx.arc(bodyR*.75,-bodyR*.38,1,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(bodyR*.75, bodyR*.38,1,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // Tail — tapered tip
  const tail=pts[0], tnext=pts[1];
  const tailAng=Math.atan2(tnext.y-tail.y, tnext.x-tail.x);
  ctx.save(); ctx.translate(tail.x,tail.y); ctx.rotate(tailAng);
  ctx.fillStyle='#6b2e06';
  ctx.beginPath(); ctx.ellipse(-bodyR*.55,0,bodyR*.75,bodyR*.55,0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  ctx.restore();
}

// ─── Groundnut (peanut — healing pickup) ─────────────────────────────────
function drawPeanut(p, t) {
  const bob=Math.sin(t*2.5+p.phase)*2;
  ctx.save(); ctx.translate(p.x-cam.x, p.y-cam.y+bob);

  // Soft green heal glow
  const grd=ctx.createRadialGradient(0,0,0,0,0,20);
  grd.addColorStop(0,'rgba(74,222,128,0.30)'); grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.fill();

  ctx.rotate(0.35);   // slight natural tilt

  // ── Shell outline — classic groundnut two-lobe shape ──
  ctx.fillStyle='#d4a85a';
  ctx.beginPath();
  ctx.moveTo(-13,0);
  ctx.bezierCurveTo(-13,-9,  -7,-10, -4.5,-5.5);   // left lobe top
  ctx.bezierCurveTo(-2.5,-3,  2.5,-3,  4.5,-5.5);   // waist top
  ctx.bezierCurveTo(  7,-10,  13, -9,   13,  0);     // right lobe top → right tip
  ctx.bezierCurveTo( 13,  9,   7, 10,  4.5, 5.5);   // right lobe bottom
  ctx.bezierCurveTo( 2.5,  3, -2.5, 3, -4.5, 5.5);  // waist bottom
  ctx.bezierCurveTo( -7, 10, -13,  9,  -13,  0);    // left lobe bottom → left tip
  ctx.closePath(); ctx.fill();

  // Waist pinch — darker
  ctx.fillStyle='#b58a3a';
  ctx.beginPath();
  ctx.moveTo(-4.5,-4); ctx.bezierCurveTo(-2,-2.5, 2,-2.5, 4.5,-4);
  ctx.bezierCurveTo(3.5,0, 3.5,0, 4.5,4);
  ctx.bezierCurveTo(2,2.5, -2,2.5, -4.5,4);
  ctx.bezierCurveTo(-3.5,0, -3.5,0, -4.5,-4);
  ctx.closePath(); ctx.fill();

  // Net-like ridge texture (characteristic peanut pattern)
  ctx.strokeStyle='#9c6e2a'; ctx.lineWidth=0.65;
  // Left lobe vertical ridges
  [[-9.5,-7,-10,0,-9.5,7], [-6,-8.5,-6.5,0,-6,8.5]].forEach(([x1,y1,cx,cy,x2,y2])=>{
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(cx,cy,x2,y2); ctx.stroke();
  });
  // Left lobe horizontal ridges
  [[-13,-4,-8,-4,-4.5,-2.5], [-13,4,-8,4,-4.5,2.5]].forEach(([x1,y1,cx,cy,x2,y2])=>{
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(cx,cy,x2,y2); ctx.stroke();
  });
  // Right lobe vertical ridges
  [[9.5,-7,10,0,9.5,7], [6,-8.5,6.5,0,6,8.5]].forEach(([x1,y1,cx,cy,x2,y2])=>{
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(cx,cy,x2,y2); ctx.stroke();
  });
  // Right lobe horizontal ridges
  [[13,-4,8,-4,4.5,-2.5], [13,4,8,4,4.5,2.5]].forEach(([x1,y1,cx,cy,x2,y2])=>{
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(cx,cy,x2,y2); ctx.stroke();
  });

  // End dimples
  ctx.fillStyle='#9c6e2a';
  ctx.beginPath(); ctx.arc(-11.5,0,2,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc( 11.5,0,2,0,Math.PI*2); ctx.fill();

  // Highlights
  ctx.fillStyle='rgba(255,242,195,0.45)';
  ctx.beginPath(); ctx.ellipse(-7,-3.5,3,4.5,-0.2,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 7,-3.5,3,4.5, 0.2,0,Math.PI*2); ctx.fill();

  // Green heal cross
  ctx.fillStyle='#22c55e'; ctx.shadowColor='#4ade80'; ctx.shadowBlur=8;
  ctx.fillRect(-1.5,-17,3,8); ctx.fillRect(-4.5,-14,9,3);
  ctx.shadowBlur=0;

  ctx.restore();
}

// ─── Walnut (immunity pickup) ─────────────────────────────────────────────
function drawWalnut(w, t) {
  const bob=Math.sin(t*2+w.phase)*2, pulse=Math.sin(t*4+w.phase)*.2+.8;
  ctx.save(); ctx.translate(w.x-cam.x, w.y-cam.y+bob);
  const grd=ctx.createRadialGradient(0,0,0,0,0,22);
  grd.addColorStop(0,`rgba(251,191,36,${.28*pulse})`); grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#7a4f28'; ctx.beginPath(); ctx.arc(0,0,11,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#5c3a1a';
  ctx.beginPath();
  ctx.moveTo(0,-11); ctx.bezierCurveTo(6,-8,11,-4,11,0); ctx.bezierCurveTo(11,4,6,8,0,11);
  ctx.bezierCurveTo(-4,8,-6,4,-5,0); ctx.bezierCurveTo(-6,-4,-4,-8,0,-11); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#3d2208'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,-11); ctx.bezierCurveTo(4,-5,4,5,0,11); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,-11); ctx.bezierCurveTo(-4,-5,-4,5,0,11); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-11,0); ctx.bezierCurveTo(-5,-4,5,-4,11,0); ctx.stroke();
  ctx.fillStyle='rgba(255,220,150,0.28)'; ctx.beginPath(); ctx.ellipse(-3,-4,4,3,-0.5,0,Math.PI*2); ctx.fill();
  const ss=3.5*pulse;
  ctx.shadowColor='#f59e0b'; ctx.shadowBlur=10; ctx.fillStyle='#fbbf24';
  ctx.beginPath();
  ctx.moveTo(0,-18); ctx.lineTo(ss*.5,-18+ss*1.5); ctx.lineTo(ss*2,-18+ss*1.5);
  ctx.lineTo(ss*.7,-18+ss*2.5); ctx.lineTo(ss*1.2,-18+ss*4);
  ctx.lineTo(0,-18+ss*3); ctx.lineTo(-ss*1.2,-18+ss*4); ctx.lineTo(-ss*.7,-18+ss*2.5);
  ctx.lineTo(-ss*2,-18+ss*1.5); ctx.lineTo(-ss*.5,-18+ss*1.5);
  ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
  ctx.restore();
}

// ─── Particles ────────────────────────────────────────────────────────────
const particles=[];
function spawnParticles(x,y,color,n=10) {
  for(let i=0;i<n;i++) {
    const a=rand(0,Math.PI*2), sp=rand(1.5,5.5);
    particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1,color,size:rand(2,5),star:Math.random()<.35});
  }
}
function updateParticles() {
  for(let i=particles.length-1;i>=0;i--) {
    const p=particles[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=.08; p.vx*=.97; p.life-=.03;
    if(p.life<=0) particles.splice(i,1);
  }
}
function drawParticles() {
  for(const p of particles) {
    ctx.save(); ctx.globalAlpha=p.life;
    if(p.star) {
      const s=p.size*p.life*.8; ctx.fillStyle='#fff'; ctx.shadowColor=p.color; ctx.shadowBlur=7;
      ctx.beginPath();
      ctx.moveTo(p.x-cam.x,p.y-cam.y-s*2); ctx.lineTo(p.x-cam.x+s*.5,p.y-cam.y-s*.5);
      ctx.lineTo(p.x-cam.x+s*2,p.y-cam.y); ctx.lineTo(p.x-cam.x+s*.5,p.y-cam.y+s*.5);
      ctx.lineTo(p.x-cam.x,p.y-cam.y+s*2); ctx.lineTo(p.x-cam.x-s*.5,p.y-cam.y+s*.5);
      ctx.lineTo(p.x-cam.x-s*2,p.y-cam.y); ctx.lineTo(p.x-cam.x-s*.5,p.y-cam.y-s*.5);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x-cam.x,p.y-cam.y,p.size*p.life,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}

// ─── Flash, vignette, aura, immunity bar ──────────────────────────────────
const flash={alpha:0,color:'#fff'};
function triggerFlash(c='#fff',s=0.4){flash.color=c;flash.alpha=s;}
function drawFlash(){if(flash.alpha<=0)return;ctx.fillStyle=flash.color;ctx.globalAlpha=flash.alpha;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;flash.alpha-=.04;}
function drawVignette(){
  const g=ctx.createRadialGradient(W/2,H/2,H*.30,W/2,H/2,H*.72);
  g.addColorStop(0,'transparent'); g.addColorStop(1,'rgba(5,20,8,0.50)');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
}
function drawPlayerAura(){
  const px=player.x-cam.x, py=player.y-cam.y;
  const g=ctx.createRadialGradient(px,py,0,px,py,90);
  const col=hasWalnutImmunity()?'rgba(251,191,36,0.12)':'rgba(109,73,216,0.10)';
  g.addColorStop(0,col); g.addColorStop(1,'transparent');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
}
function drawImmunityBar(){
  if(!hasWalnutImmunity()) return;
  const rem=clamp((walnutImmunityEnd-t)/15,0,1);
  const bw=200,bh=6,bx=W/2-100,by=H-22;
  ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(bx-2,by-14,204,22);
  ctx.fillStyle='#fbbf24'; ctx.shadowColor='#f59e0b'; ctx.shadowBlur=8;
  ctx.fillRect(bx,by,bw*rem,bh); ctx.shadowBlur=0;
  ctx.fillStyle='#fde68a'; ctx.font='500 8px "JetBrains Mono",monospace';
  ctx.textAlign='center'; ctx.fillText('✦ WALNUT IMMUNITY ✦',W/2,by-3); ctx.textAlign='left';
}

// ─── Game state ───────────────────────────────────────────────────────────
const PLAYER_SPEED=2.5, PLAYER_R=12;
const player={x:1*TILE+TILE/2, y:1*TILE+TILE/2, vx:0,vy:0, hp:100,maxHp:100, dir:'right', flap:0, invincible:0, score:0, wave:1};
let orbs=[], eagles=[], peanuts=[], walnuts=[];
let gameOver=false, gameWon=false, t=0, waveStartTime=0;
let walnutImmunityEnd=0;
function hasWalnutImmunity(){ return t<walnutImmunityEnd; }

function validFloorPos(){
  let x,y,tx,ty,att=0;
  do{tx=randi(1,COLS-1);ty=randi(1,ROWS-1);x=tx*TILE+TILE/2;y=ty*TILE+TILE/2;att++;}
  while((isSolid(tx,ty)||dist({x,y},player)<140)&&att<200);
  return{x,y};
}
function spawnOrbs(n)   { for(let i=0;i<n;i++){const p=validFloorPos();orbs.push({...p,color:'#8B4513',phase:rand(0,Math.PI*2),value:10});} }
function spawnPeanuts(n){ for(let i=0;i<n;i++){const p=validFloorPos();peanuts.push({...p,phase:rand(0,Math.PI*2)});} }
function spawnWalnuts(n){ for(let i=0;i<n;i++){const p=validFloorPos();walnuts.push({...p,phase:rand(0,Math.PI*2)});} }
function spawnEagles(n,w){
  for(let i=0;i<n;i++){
    const p=validFloorPos();
    const initAng=Math.atan2(player.y-p.y, player.x-p.x);
    eagles.push({x:p.x,y:p.y,
      vx:0, vy:0,
      speed:1.6+(w-1)*.3,          // scales 1.6 → 2.8 over waves
      phase:rand(0,Math.PI*2), wingCycle: rand(0,Math.PI*2), flap: 0, hp:1,
      dir:initAng, drawAngle:initAng});
  }
}

function startWave(w){
  player.wave=w; waveEl.textContent=w;
  generateMap(); orbs=[]; eagles=[]; peanuts=[]; walnuts=[];
  player.x = 1 * TILE + TILE / 2;
  player.y = 1 * TILE + TILE / 2;
  player.dir = 'right';
  spawnOrbs(5+w*2);
  spawnEagles(2+w*2, w);
  spawnPeanuts(2+Math.floor(w/2));   // 2–4
  spawnWalnuts(w>2?2:1);             // 1–2
  triggerFlash('#a78bfa',0.3); sfxWave();
  waveStartTime=t;
}
startWave(1);

function circleVsMap(cx,cy,r){
  for(const[px,py]of[[cx-r,cy-r],[cx+r,cy-r],[cx-r,cy+r],[cx+r,cy+r],[cx,cy-r],[cx,cy+r],[cx-r,cy],[cx+r,cy]])
    if(isSolid(Math.floor(px/TILE),Math.floor(py/TILE))) return true;
  return false;
}

// ─── Update player ────────────────────────────────────────────────────────
function updatePlayer() {
  const kbX = (keys['ArrowRight']||keys['d']||keys['D']) ? 1 : (keys['ArrowLeft']||keys['a']||keys['A']) ? -1 : 0;
  const kbY = (keys['ArrowDown']||keys['s']||keys['S']) ? 1 : (keys['ArrowUp']||keys['w']||keys['W']) ? -1 : 0;
  let dx = 0, dy = 0;
  let speed = PLAYER_SPEED;

  if (joyInput.active && (joyInput.dx || joyInput.dy)) {
    dx = joyInput.dx;
    dy = joyInput.dy;
    speed *= 0.45 + 0.55 * joyInput.strength;
  } else if (kbX || kbY) {
    const len = Math.hypot(kbX, kbY);
    if (len > 0) { dx = kbX / len; dy = kbY / len; }
  }

  if (dx || dy) {
    const nextX = player.x + dx * speed;
    const nextY = player.y + dy * speed;
    if (!circleVsMap(nextX, player.y, PLAYER_R)) player.x = nextX;
    if (!circleVsMap(player.x, nextY, PLAYER_R)) player.y = nextY;
    player.flap += 0.22 + Math.abs(dx * dy) * 0.08;
    player.dir = Math.atan2(dy, dx);
  }

  if (player.invincible > 0) player.invincible--;
}

// ─── Update eagles ────────────────────────────────────────────────────────
function updateEagles() {
  for (const e of eagles) {
    e.wingCycle += 0.24 + Math.abs(e.speed) * 0.03;
    e.flap = Math.sin(e.wingCycle);

    const toPlayer = Math.atan2(player.y - e.y, player.x - e.x);
    const localDrift = Math.sin(t * 0.9 + e.phase) * 0.28;
    const desiredAngle = toPlayer + localDrift * (e.speed * 0.16);
    const desiredVx = Math.cos(desiredAngle) * e.speed;
    const desiredVy = Math.sin(desiredAngle) * e.speed;
    const blend = 0.05 + Math.min(0.14, e.speed * 0.016);
    e.vx = lerp(e.vx, desiredVx, blend);
    e.vy = lerp(e.vy, desiredVy, blend);

    const nextX = e.x + e.vx;
    const nextY = e.y + e.vy;
    const minX = TILE * 1.5;
    const maxX = COLS * TILE - TILE * 1.5;
    const minY = TILE * 1.5;
    const maxY = ROWS * TILE - TILE * 1.5;
    if (nextX < minX || nextX > maxX) e.vx *= -0.9;
    if (nextY < minY || nextY > maxY) e.vy *= -0.9;

    e.x += e.vx;
    e.y += e.vy;
    e.drawAngle = lerpAngle(e.drawAngle, Math.atan2(e.vy, e.vx), 0.16);

    if (player.invincible === 0 && !hasWalnutImmunity() && dist(e, player) < PLAYER_R + 16) {
      player.hp = Math.max(0, player.hp - 8);
      player.invincible = 60;
      triggerFlash('#dc2626', 0.4);
      triggerShake(7);
      sfxHit();
      hpEl.textContent = player.hp;
      if (player.hp <= 0) gameOver = true;
    }
  }
}

// ─── Collect pickups ──────────────────────────────────────────────────────
function collectPickups(){
  for(let i=orbs.length-1;i>=0;i--) if(dist(orbs[i],player)<PLAYER_R+10){
    spawnParticles(orbs[i].x,orbs[i].y,'#8B4513',10);
    spawnParticles(orbs[i].x,orbs[i].y,'#a78bfa',5);
    sfxCollect(); player.score+=orbs[i].value; scoreEl.textContent=player.score; orbs.splice(i,1);
  }
  for(let i=peanuts.length-1;i>=0;i--) if(dist(peanuts[i],player)<PLAYER_R+11){
    player.hp=Math.min(player.maxHp,player.hp+25); hpEl.textContent=player.hp;
    spawnParticles(peanuts[i].x,peanuts[i].y,'#4ade80',14);
    spawnParticles(peanuts[i].x,peanuts[i].y,'#86efac',6);
    sfxHeal(); triggerFlash('#4ade80',0.16); peanuts.splice(i,1);
  }
  for(let i=walnuts.length-1;i>=0;i--) if(dist(walnuts[i],player)<PLAYER_R+13){
    walnutImmunityEnd=t+15;
    spawnParticles(walnuts[i].x,walnuts[i].y,'#fbbf24',18);
    spawnParticles(walnuts[i].x,walnuts[i].y,'#fff',8);
    sfxPowerUp(); triggerFlash('#fbbf24',0.26); walnuts.splice(i,1);
  }
  if(orbs.length===0&&!gameOver&&!gameWon){
    const nx=player.wave+1; if(nx>5){gameWon=true;return;} startWave(nx);
  }
}

// ─── Minimap ──────────────────────────────────────────────────────────────
function drawMiniMap(){
  const mw=80,mh=56,mx=W-mw-8,my=8;
  ctx.fillStyle='rgba(5,15,8,0.82)'; ctx.fillRect(mx,my,mw,mh);
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    ctx.fillStyle=MAP[r][c]===1?'#5a3a22':'#2c7a3e';
    ctx.fillRect(mx+c*(mw/COLS),my+r*(mh/ROWS),mw/COLS+.5,mh/ROWS+.5);
  }
  ctx.fillStyle='#86efac';
  for(const p of peanuts) ctx.fillRect(mx+(p.x/(COLS*TILE))*mw-1,my+(p.y/(ROWS*TILE))*mh-1,2,2);
  ctx.shadowColor='#fbbf24'; ctx.shadowBlur=3; ctx.fillStyle='#fbbf24';
  for(const w of walnuts) ctx.fillRect(mx+(w.x/(COLS*TILE))*mw-1,my+(w.y/(ROWS*TILE))*mh-1,2,2);
  ctx.shadowBlur=0;
  const pdx=(player.x/(COLS*TILE))*mw, pdy=(player.y/(ROWS*TILE))*mh;
  ctx.shadowColor='#a78bfa'; ctx.shadowBlur=4; ctx.fillStyle='#a78bfa';
  ctx.fillRect(mx+pdx-1.5,my+pdy-1.5,3,3);
  ctx.shadowColor='#f59e0b'; ctx.shadowBlur=3; ctx.fillStyle='#f59e0b';
  for(const e of eagles) ctx.fillRect(mx+(e.x/(COLS*TILE))*mw-1,my+(e.y/(ROWS*TILE))*mh-1,2,2);
  ctx.shadowBlur=0; ctx.strokeStyle='#1d5429'; ctx.lineWidth=1; ctx.strokeRect(mx,my,mw,mh);
}

// ─── Overlay ──────────────────────────────────────────────────────────────
function drawOverlay(title,sub1,sub2){
  ctx.fillStyle='rgba(7,6,13,0.88)'; ctx.fillRect(0,0,W,H);
  const cx=W/2,cy=H/2;
  ctx.strokeStyle='rgba(109,73,216,0.38)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(cx-220,cy-80); ctx.lineTo(cx+220,cy-80); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx-220,cy+68); ctx.lineTo(cx+220,cy+68); ctx.stroke();
  ctx.fillStyle='#6d49d8';
  [[-220,-80],[220,-80],[-220,68],[220,68]].forEach(([ox,oy])=>{ctx.beginPath();ctx.arc(cx+ox,cy+oy,3,0,Math.PI*2);ctx.fill();});
  ctx.textAlign='center';
  ctx.shadowColor='rgba(167,139,250,0.9)'; ctx.shadowBlur=40;
  ctx.fillStyle='#c4b5fd'; ctx.font='italic 500 58px "Cormorant Garamond",serif';
  ctx.fillText(title,cx,cy-18); ctx.shadowBlur=0;
  ctx.fillStyle='#ede9fe'; ctx.font='400 24px "Cormorant Garamond",serif'; ctx.fillText(sub1,cx,cy+22);
  ctx.fillStyle='#565273'; ctx.font='600 10px "JetBrains Mono",monospace'; ctx.fillText(sub2.toUpperCase(),cx,cy+54);
  ctx.textAlign='left';
}

// ─── Wave announcement ────────────────────────────────────────────────────
function drawWaveAnnounce(){
  const el=t-waveStartTime; if(el>=5.0)return;
  const alpha=clamp(el<4.0?1:1-(el-4.0),0,1);
  ctx.save(); ctx.globalAlpha=alpha; ctx.textAlign='center';
  ctx.shadowColor='rgba(167,139,250,0.9)'; ctx.shadowBlur=24;
  ctx.fillStyle='#c4b5fd'; ctx.font='italic 500 46px "Cormorant Garamond",serif';
  ctx.fillText(`Wave ${player.wave}`,W/2,H/2-10); ctx.shadowBlur=0;
  ctx.fillStyle='#565273'; ctx.font='600 10px "JetBrains Mono",monospace';
  ctx.fillText('COLLECT ALL WORMS',W/2,H/2+20);
  ctx.restore(); ctx.textAlign='left';
}

// ─── Restart ──────────────────────────────────────────────────────────────
window.addEventListener('keydown',e=>{if((gameOver||gameWon)&&e.key==='Enter')resetGame();});
canvas.addEventListener('touchstart',e=>{e.preventDefault();bootAudio();if(gameOver||gameWon)resetGame();},{passive:false});
function resetGame(){
  player.hp=100; player.score=0; player.invincible=0; player.flap=0; player.dir='right';
  gameOver=false; gameWon=false;
  gameOverSfxPlayed=false; gameWonSfxPlayed=false; walnutImmunityEnd=0;
  hpEl.textContent=100; scoreEl.textContent=0; particles.length=0; t=0;
  startWave(1);
}

// ─── Main loop ────────────────────────────────────────────────────────────
function loop(){
  requestAnimationFrame(loop);
  t+=0.016;
  if(!gameOver&&!gameWon){updatePlayer();updateEagles();collectPickups();updateParticles();updateShake();}
  updateCam(player.x,player.y);

  ctx.save(); ctx.translate(shake.x,shake.y); ctx.clearRect(-16,-16,W+32,H+32);

  drawTiles();
  drawPlayerAura();
  drawParticles();
  for(const o of orbs)    drawOrb(o,t);
  for(const p of peanuts) drawPeanut(p,t);
  for(const w of walnuts) drawWalnut(w,t);
  for(const e of eagles)  drawEagle(e,t);

  const blink=player.invincible>0&&Math.floor(player.invincible/6)%2===0;
  if(!blink) drawRaven(player.x-cam.x,player.y-cam.y,player.dir,player.flap,player.hp);

  drawVignette(); drawFlash(); drawMiniMap(); drawImmunityBar(); drawWaveAnnounce();
  ctx.restore();

  if(gameOver){if(!gameOverSfxPlayed){sfxGameOver();gameOverSfxPlayed=true;}
    drawOverlay('☠ Game Over',`Soul Essence: ${player.score}`,'Tap screen or press Enter to restart');}
  if(gameWon){if(!gameWonSfxPlayed){sfxVictory();gameWonSfxPlayed=true;}
    drawOverlay('✦ Victory ✦',`Final Essence: ${player.score}`,'Tap screen or press Enter to play again');}
}
loop();
