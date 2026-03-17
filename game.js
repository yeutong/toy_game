const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('ui-overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const finalScore = document.getElementById('final-score');
const overlayPrompt = document.getElementById('overlay-prompt');

// --- Canvas sizing ---
const W = 400;
const H = 600;
canvas.width = W;
canvas.height = H;

// --- Constants ---
const LANE_COUNT = 3;
const LANE_WIDTH = 100;
const ROAD_LEFT = (W - LANE_COUNT * LANE_WIDTH) / 2;
const ROAD_RIGHT = ROAD_LEFT + LANE_COUNT * LANE_WIDTH;
const PLAYER_SIZE = 32;
const DOG_W = 36;
const DOG_H = 28;
const ROAD_SPEED_INITIAL = 3;
const ROAD_SPEED_MAX = 9;
const ROAD_ACCEL = 0.0005;
const SPAWN_INTERVAL_INITIAL = 90; // frames
const SPAWN_INTERVAL_MIN = 30;
const KICK_RANGE = 55;
const KICK_DURATION = 15;
const BITTEN_DURATION = 60;

// --- State ---
let state = 'title'; // title | playing | dying | gameover
let score = 0;
let highScore = 0;
let roadSpeed = ROAD_SPEED_INITIAL;
let spawnTimer = 0;
let spawnInterval = SPAWN_INTERVAL_INITIAL;
let frameCount = 0;
let playerLane = 1; // 0, 1, 2
let playerY = H - 100;
let playerTargetX = laneX(1);
let playerX = playerTargetX;
let dogs = [];
let roadMarkOffset = 0;
let shakeTimer = 0;
let kickTimer = 0;
let bittenTimer = 0;
let bloodParticles = [];
let biterDog = null; // the dog that bit the player
let floatingTexts = []; // {x, y, text, life}
let kickCount = 0; // easter egg: kick 5+ to unlock lawn hiding
let onLawn = false;

// --- Audio (Web Audio API, no files needed) ---
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playBark(breed) {
  const ac = getAudioCtx();
  const t = ac.currentTime;
  switch (breed) {
    case 0: barkShiba(ac, t); break;
    case 1: barkCorgi(ac, t); break;
    case 2: barkPoodle(ac, t); break;
    case 3: barkDalmatian(ac, t); break;
  }
}

// Shiba Inu: high-pitched quick double yap
function barkShiba(ac, t) {
  [0, 0.1].forEach(off => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(900 - off * 500, t + off);
    o.frequency.exponentialRampToValueAtTime(500, t + off + 0.06);
    g.gain.setValueAtTime(0.3, t + off);
    g.gain.exponentialRampToValueAtTime(0.01, t + off + 0.08);
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 1;
    o.connect(f); f.connect(g); g.connect(ac.destination);
    o.start(t + off); o.stop(t + off + 0.1);
  });
}

// Corgi: bouncy cartoon bark
function barkCorgi(ac, t) {
  // Pop
  const o1 = ac.createOscillator(), g1 = ac.createGain();
  o1.type = 'square';
  o1.frequency.setValueAtTime(800, t);
  o1.frequency.exponentialRampToValueAtTime(300, t + 0.05);
  g1.gain.setValueAtTime(0.3, t);
  g1.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
  o1.connect(g1); g1.connect(ac.destination);
  o1.start(t); o1.stop(t + 0.08);
  // Woof
  const o2 = ac.createOscillator(), g2 = ac.createGain();
  o2.type = 'sawtooth';
  o2.frequency.setValueAtTime(350, t + 0.04);
  o2.frequency.exponentialRampToValueAtTime(150, t + 0.15);
  g2.gain.setValueAtTime(0.0001, t + 0.03);
  g2.gain.linearRampToValueAtTime(0.35, t + 0.05);
  g2.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
  o2.connect(f); f.connect(g2); g2.connect(ac.destination);
  o2.start(t + 0.03); o2.stop(t + 0.2);
  // Bounce tail
  const o3 = ac.createOscillator(), g3 = ac.createGain();
  o3.type = 'sine';
  o3.frequency.setValueAtTime(500, t + 0.12);
  o3.frequency.exponentialRampToValueAtTime(250, t + 0.2);
  g3.gain.setValueAtTime(0.0001, t + 0.11);
  g3.gain.linearRampToValueAtTime(0.15, t + 0.13);
  g3.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
  o3.connect(g3); g3.connect(ac.destination);
  o3.start(t + 0.11); o3.stop(t + 0.25);
}

// Poodle: high-pitched yelp
function barkPoodle(ac, t) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(500, t);
  o.frequency.linearRampToValueAtTime(1200, t + 0.05);
  o.frequency.exponentialRampToValueAtTime(600, t + 0.2);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.3, t + 0.02);
  g.gain.setValueAtTime(0.25, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
  o.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + 0.3);
  // Harmonic
  const o2 = ac.createOscillator(), g2 = ac.createGain();
  o2.type = 'triangle';
  o2.frequency.setValueAtTime(1000, t);
  o2.frequency.linearRampToValueAtTime(2400, t + 0.05);
  o2.frequency.exponentialRampToValueAtTime(1200, t + 0.2);
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.linearRampToValueAtTime(0.1, t + 0.02);
  g2.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
  o2.connect(g2); g2.connect(ac.destination);
  o2.start(t); o2.stop(t + 0.25);
}

// Dalmatian: classic medium woof
function barkDalmatian(ac, t) {
  // Noise burst
  const buf = ac.createBuffer(1, ac.sampleRate * 0.15, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const ns = ac.createBufferSource(); ns.buffer = buf;
  const nf = ac.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 600; nf.Q.value = 3;
  const ng = ac.createGain(); ng.gain.setValueAtTime(0.2, t); ng.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
  ns.connect(nf); nf.connect(ng); ng.connect(ac.destination);
  ns.start(t); ns.stop(t + 0.12);
  // Tonal
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(400, t);
  o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 800;
  o.connect(f); f.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + 0.18);
}

let bgmStarted = false;
let bgmGain = null;
function startBGM() {
  if (bgmStarted) return;
  bgmStarted = true;
  const ac = getAudioCtx();
  bgmGain = ac.createGain();
  bgmGain.gain.value = 0.08;
  bgmGain.connect(ac.destination);

  // Simple looping chiptune melody
  const notes = [262, 294, 330, 349, 392, 349, 330, 294]; // C D E F G F E D
  const noteLen = 0.25;
  function playLoop() {
    if (!bgmStarted) return;
    const now = ac.currentTime;
    for (let i = 0; i < notes.length; i++) {
      const osc = ac.createOscillator();
      osc.type = 'square';
      osc.frequency.value = notes[i];
      const g = ac.createGain();
      g.gain.setValueAtTime(0.08, now + i * noteLen);
      g.gain.setValueAtTime(0, now + i * noteLen + noteLen * 0.8);
      osc.connect(g);
      g.connect(bgmGain);
      osc.start(now + i * noteLen);
      osc.stop(now + i * noteLen + noteLen);
    }
    // Bass line
    const bassNotes = [131, 131, 175, 175, 196, 196, 175, 165];
    for (let i = 0; i < bassNotes.length; i++) {
      const osc = ac.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = bassNotes[i];
      const g = ac.createGain();
      g.gain.setValueAtTime(0.1, now + i * noteLen);
      g.gain.setValueAtTime(0, now + i * noteLen + noteLen * 0.9);
      osc.connect(g);
      g.connect(bgmGain);
      osc.start(now + i * noteLen);
      osc.stop(now + i * noteLen + noteLen);
    }
    setTimeout(playLoop, notes.length * noteLen * 1000);
  }
  playLoop();
}

function stopBGM() {
  bgmStarted = false;
  if (bgmGain) {
    bgmGain.gain.value = 0;
  }
}

// --- Helpers ---
function laneX(lane) {
  return ROAD_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// --- Input ---
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (state === 'playing') {
      kickDog();
    } else if (state === 'title' || state === 'gameover') {
      startGame();
    }
    return;
  }
  if (state !== 'playing') return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    movePlayer(-1);
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    movePlayer(1);
  }
});

// Touch / click
let touchStartX = null;
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (state === 'title' || state === 'gameover') { startGame(); return; }
  touchStartX = e.touches[0].clientX;
});
canvas.addEventListener('touchend', (e) => {
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 20) {
    movePlayer(dx > 0 ? 1 : -1);
  } else {
    // Tap without swipe = kick
    kickDog();
  }
  touchStartX = null;
});
canvas.addEventListener('click', () => {
  if (state === 'title' || state === 'gameover') startGame();
});

function movePlayer(dir) {
  const newLane = playerLane + dir;
  // Easter egg: allow moving to right lawn (lane 3) after 5+ kicks
  if (newLane === LANE_COUNT && kickCount >= 5) {
    playerLane = newLane;
    onLawn = true;
    playerTargetX = ROAD_RIGHT + (W - ROAD_RIGHT) / 2;
    return;
  }
  if (newLane >= 0 && newLane < LANE_COUNT) {
    playerLane = newLane;
    onLawn = false;
    playerTargetX = laneX(playerLane);
  }
  // Allow moving back from lawn
  if (playerLane === LANE_COUNT && newLane === LANE_COUNT - 1) {
    playerLane = newLane;
    onLawn = false;
    playerTargetX = laneX(playerLane);
  }
}

function kickDog() {
  if (kickTimer > 0) return; // already kicking

  // Find closest unkicked dog in player's lane within range
  let closest = null;
  let closestDist = Infinity;
  for (const dog of dogs) {
    if (dog.kicked) continue;
    if (dog.lane !== playerLane) continue;
    const dist = playerY - dog.y;
    if (dist > 0 && dist < KICK_RANGE && dist < closestDist) {
      closest = dog;
      closestDist = dist;
    }
  }

  kickTimer = KICK_DURATION;

  if (closest) {
    closest.kicked = true;
    closest.kickAnim = 0;
    closest.kickDirX = (Math.random() > 0.5 ? 1 : -1) * (8 + Math.random() * 4);
    closest.kickDirY = -(10 + Math.random() * 5);
    closest.kickSpin = (Math.random() - 0.5) * 0.4;
    closest.kickRotation = 0;
    score += 100;
    kickCount++;
    floatingTexts.push({ x: closest.x, y: closest.y, text: '+100', life: 1.0 });
    playBark(closest.breed);
  }
}

// --- Game logic ---
function startGame() {
  state = 'playing';
  score = 0;
  roadSpeed = ROAD_SPEED_INITIAL;
  spawnTimer = 0;
  spawnInterval = SPAWN_INTERVAL_INITIAL;
  frameCount = 0;
  playerLane = 1;
  playerTargetX = laneX(1);
  playerX = playerTargetX;
  dogs = [];
  shakeTimer = 0;
  kickTimer = 0;
  bittenTimer = 0;
  bloodParticles = [];
  biterDog = null;
  floatingTexts = [];
  kickCount = 0;
  onLawn = false;
  overlay.classList.add('hidden');
  startBGM();
}

function triggerDeath(dog) {
  state = 'dying';
  bittenTimer = BITTEN_DURATION;
  shakeTimer = 20;
  biterDog = dog;
  stopBGM();

  // Spawn blood particles
  bloodParticles = [];
  for (let i = 0; i < 12; i++) {
    bloodParticles.push({
      x: playerX,
      y: playerY,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6 - 2,
      size: 2 + Math.random() * 3,
      life: 1.0,
    });
  }
}

function gameOver() {
  state = 'gameover';
  if (score > highScore) highScore = score;
  overlayTitle.textContent = 'Game Over!';
  overlaySub.textContent = `High Score: ${highScore}`;
  finalScore.textContent = `Score: ${score}`;
  finalScore.classList.remove('hidden');
  overlayPrompt.textContent = 'Press Space or Tap to Retry';
  overlay.classList.remove('hidden');
}

function spawnDog() {
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const tooClose = dogs.some(d => d.lane === lane && d.y < 60 && !d.kicked);
  if (tooClose) return;
  const breed = Math.floor(Math.random() * 4);
  dogs.push({ lane, x: laneX(lane), y: -DOG_H, breed, kicked: false });
}

function update() {
  // Handle dying state
  if (state === 'dying') {
    bittenTimer--;
    // Update blood particles
    for (const p of bloodParticles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2; // gravity
      p.life -= 0.02;
    }
    bloodParticles = bloodParticles.filter(p => p.life > 0);

    if (bittenTimer <= 0) {
      gameOver();
    }
    return;
  }

  if (state !== 'playing') return;

  frameCount++;
  // Add 1 point every 6 frames (distance score), kick bonus is added separately
  if (frameCount % 6 === 0) score++;

  // Speed up over time
  roadSpeed = Math.min(ROAD_SPEED_MAX, ROAD_SPEED_INITIAL + frameCount * ROAD_ACCEL);
  spawnInterval = Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_INITIAL - frameCount * 0.02);

  // Kick timer
  if (kickTimer > 0) kickTimer--;

  // Spawn dogs
  spawnTimer++;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnDog();
  }

  // Move dogs
  for (const dog of dogs) {
    if (dog.kicked) {
      dog.kickAnim++;
      dog.x += dog.kickDirX;
      dog.y += dog.kickDirY;
      dog.kickDirY += 0.3; // gravity on kicked dog
      dog.kickRotation += dog.kickSpin;
    } else {
      dog.y += roadSpeed;
    }
  }

  // Remove off-screen dogs (normal and kicked)
  dogs = dogs.filter(d => {
    if (d.kicked) return d.y < H + 100 && d.y > -200 && d.x > -100 && d.x < W + 100;
    return d.y < H + 50;
  });

  // Smooth player movement
  playerX = lerp(playerX, playerTargetX, 0.2);

  // Collision detection (only unkicked dogs, skip if on lawn)
  if (onLawn) { /* safe on the lawn! */ } else
  for (const dog of dogs) {
    if (dog.kicked) continue;
    const dx = Math.abs(playerX - dog.x);
    const dy = Math.abs(playerY - dog.y);
    if (dx < (PLAYER_SIZE / 2 + DOG_W / 2 - 6) && dy < (PLAYER_SIZE / 2 + DOG_H / 2 - 4)) {
      triggerDeath(dog);
      return;
    }
  }

  // Road markings scroll
  roadMarkOffset = (roadMarkOffset + roadSpeed) % 40;

  // Update floating texts
  for (const ft of floatingTexts) {
    ft.y -= 1.5;
    ft.life -= 0.025;
  }
  floatingTexts = floatingTexts.filter(ft => ft.life > 0);
}

// --- Drawing ---
function drawRoad() {
  ctx.fillStyle = '#3a3a4a';
  ctx.fillRect(ROAD_LEFT, 0, LANE_COUNT * LANE_WIDTH, H);

  ctx.fillStyle = '#ffd700';
  ctx.fillRect(ROAD_LEFT - 4, 0, 4, H);
  ctx.fillRect(ROAD_RIGHT, 0, 4, H);

  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 20]);
  for (let i = 1; i < LANE_COUNT; i++) {
    const x = ROAD_LEFT + i * LANE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(x, -20 + roadMarkOffset);
    for (let y = -20 + roadMarkOffset; y < H + 20; y += 40) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 20);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawPlayer() {
  const x = playerX;
  const y = playerY;
  const s = PLAYER_SIZE;

  if (state === 'dying' || state === 'gameover') {
    // Player lying down, bitten
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 2); // lying on side

    // Body
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath();
    ctx.roundRect(-s / 2 + 4, -s / 2 + 8, s - 8, s - 8, 4);
    ctx.fill();

    // Head
    ctx.fillStyle = '#ffe0b2';
    ctx.beginPath();
    ctx.arc(0, -s / 2 + 6, 8, 0, Math.PI * 2);
    ctx.fill();

    // X eyes (dead)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-4, -s / 2 + 3); ctx.lineTo(-1, -s / 2 + 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1, -s / 2 + 3); ctx.lineTo(-4, -s / 2 + 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1, -s / 2 + 3); ctx.lineTo(4, -s / 2 + 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -s / 2 + 3); ctx.lineTo(1, -s / 2 + 6); ctx.stroke();

    // Legs limp
    ctx.fillStyle = '#333';
    ctx.fillRect(-5, s / 2 - 4, 4, 6);
    ctx.fillRect(1, s / 2 - 4, 4, 6);

    ctx.restore();

    // Draw blood particles
    for (const p of bloodParticles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = '#e53935';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Blood pool (grows over time)
    const poolSize = Math.min(1, (BITTEN_DURATION - bittenTimer) / 30);
    ctx.fillStyle = 'rgba(183, 28, 28, 0.6)';
    ctx.beginPath();
    ctx.ellipse(x + 5, y + 8, 12 * poolSize, 6 * poolSize, 0.2, 0, Math.PI * 2);
    ctx.fill();

    return;
  }

  // Normal or kicking player
  const isKicking = kickTimer > 0;

  // Body
  ctx.fillStyle = '#4fc3f7';
  ctx.beginPath();
  ctx.roundRect(x - s / 2 + 4, y - s / 2 + 8, s - 8, s - 8, 4);
  ctx.fill();

  // Head
  ctx.fillStyle = '#ffe0b2';
  ctx.beginPath();
  ctx.arc(x, y - s / 2 + 6, 8, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#333';
  if (isKicking) {
    // Angry eyes (>) when kicking
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - 5, y - s / 2 + 3); ctx.lineTo(x - 2, y - s / 2 + 5); ctx.lineTo(x - 5, y - s / 2 + 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 0, y - s / 2 + 3); ctx.lineTo(x + 3, y - s / 2 + 5); ctx.lineTo(x + 0, y - s / 2 + 7); ctx.stroke();
  } else {
    ctx.fillRect(x - 3, y - s / 2 + 4, 2, 2);
    ctx.fillRect(x + 1, y - s / 2 + 4, 2, 2);
  }

  // Legs
  ctx.fillStyle = '#333';
  if (isKicking) {
    // Kick pose: one leg extended forward (up)
    const kickProgress = kickTimer / KICK_DURATION;
    const kickExtend = Math.sin(kickProgress * Math.PI) * 14;
    // Standing leg
    ctx.fillRect(x + 1, y + s / 2 - 4, 4, 8);
    // Kicking leg
    ctx.save();
    ctx.translate(x - 3, y + s / 2 - 4);
    ctx.rotate(-kickExtend * 0.06);
    ctx.fillRect(0, 0, 4, 8);
    // Foot
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(2, -kickExtend * 0.3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    const legAnim = Math.sin(frameCount * 0.3) * 3;
    ctx.fillRect(x - 5, y + s / 2 - 4, 4, 6 + legAnim);
    ctx.fillRect(x + 1, y + s / 2 - 4, 4, 6 - legAnim);
  }
}

// --- Dog breeds ---
function drawDog(dog) {
  const x = dog.x;
  const y = dog.y;

  if (dog.kicked) {
    // Draw kicked dog flying and spinning
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(dog.kickRotation);
    const scale = Math.max(0.3, 1 - dog.kickAnim * 0.015);
    ctx.scale(scale, scale);

    const legAnim = 0;
    const tailWag = 0;
    switch (dog.breed) {
      case 0: drawShiba(0, 0, legAnim, tailWag); break;
      case 1: drawCorgi(0, 0, legAnim); break;
      case 2: drawPoodle(0, 0, legAnim, tailWag); break;
      case 3: drawDalmatian(0, 0, legAnim, tailWag); break;
    }

    // Star burst effect
    ctx.fillStyle = '#ffd700';
    const sparkle = dog.kickAnim * 0.5;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + sparkle;
      const r = 25 + Math.sin(sparkle * 2 + i) * 8;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    return;
  }

  const bounce = Math.sin(frameCount * 0.15 + dog.y) * 2;
  const legAnim = Math.sin(frameCount * 0.4 + dog.y) * 3;
  const tailWag = Math.sin(frameCount * 0.25 + dog.y) * 8;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(x, y + 28, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(0, bounce);

  switch (dog.breed) {
    case 0: drawShiba(x, y, legAnim, tailWag); break;
    case 1: drawCorgi(x, y, legAnim); break;
    case 2: drawPoodle(x, y, legAnim, tailWag); break;
    case 3: drawDalmatian(x, y, legAnim, tailWag); break;
  }

  ctx.restore();
}

function drawShiba(x, y, legAnim, tailWag) {
  ctx.fillStyle = '#f0c060';
  ctx.beginPath(); ctx.ellipse(x, y + 4, 16, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff8e8';
  ctx.beginPath(); ctx.ellipse(x, y + 8, 10, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0c060';
  ctx.beginPath(); ctx.arc(x, y - 14, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff8e8';
  ctx.beginPath(); ctx.ellipse(x, y - 9, 9, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e0a830';
  ctx.beginPath(); ctx.moveTo(x - 10, y - 22); ctx.lineTo(x - 16, y - 36); ctx.lineTo(x - 2, y - 26); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 10, y - 22); ctx.lineTo(x + 16, y - 36); ctx.lineTo(x + 2, y - 26); ctx.fill();
  ctx.fillStyle = '#ffccaa';
  ctx.beginPath(); ctx.moveTo(x - 9, y - 23); ctx.lineTo(x - 13, y - 33); ctx.lineTo(x - 4, y - 26); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 9, y - 23); ctx.lineTo(x + 13, y - 33); ctx.lineTo(x + 4, y - 26); ctx.fill();
  ctx.fillStyle = '#2a1a0a';
  ctx.beginPath(); ctx.ellipse(x - 5, y - 16, 2.5, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 5, y - 16, 2.5, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x - 4, y - 17, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 6, y - 17, 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.ellipse(x, y - 8, 3, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x, y - 5.5); ctx.lineTo(x - 3, y - 3); ctx.moveTo(x, y - 5.5); ctx.lineTo(x + 3, y - 3); ctx.stroke();
  ctx.fillStyle = '#f0c060';
  ctx.beginPath(); ctx.roundRect(x - 11, y + 15, 7, 10 + legAnim, 3); ctx.fill();
  ctx.beginPath(); ctx.roundRect(x + 4, y + 15, 7, 10 - legAnim, 3); ctx.fill();
  ctx.fillStyle = '#fff8e8';
  ctx.beginPath(); ctx.ellipse(x - 7.5, y + 26 + legAnim, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 7.5, y + 26 - legAnim, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f0c060'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + 14, y); ctx.quadraticCurveTo(x + 26 + tailWag * 0.3, y - 8, x + 20, y - 18); ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawCorgi(x, y, legAnim) {
  ctx.fillStyle = '#f0a040';
  ctx.beginPath(); ctx.ellipse(x, y + 2, 18, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(x, y + 6, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0a040';
  ctx.beginPath(); ctx.ellipse(x, y - 14, 13, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(x, y - 11, 6, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0a040';
  ctx.beginPath(); ctx.moveTo(x - 8, y - 22); ctx.lineTo(x - 15, y - 38); ctx.lineTo(x - 1, y - 24); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 8, y - 22); ctx.lineTo(x + 15, y - 38); ctx.lineTo(x + 1, y - 24); ctx.fill();
  ctx.fillStyle = '#ffccaa';
  ctx.beginPath(); ctx.moveTo(x - 7, y - 23); ctx.lineTo(x - 12, y - 34); ctx.lineTo(x - 2, y - 24); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 7, y - 23); ctx.lineTo(x + 12, y - 34); ctx.lineTo(x + 2, y - 24); ctx.fill();
  ctx.fillStyle = '#2a1a0a';
  ctx.beginPath(); ctx.arc(x - 5, y - 16, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 5, y - 16, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x - 4, y - 17, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 6, y - 17, 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.ellipse(x, y - 8, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff8888';
  ctx.beginPath(); ctx.ellipse(x, y - 3, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0a040';
  ctx.beginPath(); ctx.roundRect(x - 14, y + 12, 7, 8 + legAnim, 3); ctx.fill();
  ctx.beginPath(); ctx.roundRect(x + 7, y + 12, 7, 8 - legAnim, 3); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(x - 10.5, y + 21 + legAnim, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 10.5, y + 21 - legAnim, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
}

function drawPoodle(x, y, legAnim, tailWag) {
  ctx.fillStyle = '#e8e0f0';
  for (let a = 0; a < Math.PI * 2; a += 0.8) {
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * 12, y + Math.sin(a) * 10, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.beginPath(); ctx.ellipse(x, y, 14, 12, 0, 0, Math.PI * 2); ctx.fill();
  for (let a = 0; a < Math.PI * 2; a += 0.7) {
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * 8, y - 16 + Math.sin(a) * 8, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(x, y - 16, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8d0e4';
  ctx.beginPath(); ctx.ellipse(x - 13, y - 12, 6, 12, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 13, y - 12, 6, 12, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a1a2a';
  ctx.beginPath(); ctx.arc(x - 5, y - 18, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 5, y - 18, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x - 4, y - 19, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 6, y - 19, 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0e4f0';
  ctx.beginPath(); ctx.ellipse(x, y - 10, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.ellipse(x, y - 12, 2.5, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8d0e4';
  ctx.fillRect(x - 9, y + 10, 4, 14 + legAnim);
  ctx.fillRect(x + 5, y + 10, 4, 14 - legAnim);
  ctx.fillStyle = '#e8e0f0';
  ctx.beginPath(); ctx.arc(x - 7, y + 24 + legAnim, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 7, y + 24 - legAnim, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 16 + tailWag * 0.3, y - 6, 6, 0, Math.PI * 2); ctx.fill();
}

function drawDalmatian(x, y, legAnim, tailWag) {
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath(); ctx.ellipse(x, y + 2, 17, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(x - 6, y - 2, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 8, y + 4, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 2, y + 8, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 10, y + 6, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath(); ctx.ellipse(x, y - 15, 12, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.ellipse(x + 6, y - 20, 5, 4, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x - 11, y - 16, 5, 10, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 11, y - 16, 5, 10, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#eee';
  ctx.beginPath(); ctx.ellipse(x, y - 9, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a1a0a';
  ctx.beginPath(); ctx.arc(x - 5, y - 17, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 5, y - 17, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x - 4, y - 18, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 6, y - 18, 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.ellipse(x, y - 9, 3, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath(); ctx.roundRect(x - 12, y + 12, 6, 12 + legAnim, 3); ctx.fill();
  ctx.beginPath(); ctx.roundRect(x + 6, y + 12, 6, 12 - legAnim, 3); ctx.fill();
  ctx.fillStyle = '#eee';
  ctx.beginPath(); ctx.ellipse(x - 9, y + 25 + legAnim, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 9, y + 25 - legAnim, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f5f5f5'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + 15, y); ctx.quadraticCurveTo(x + 24 + tailWag * 0.3, y - 6, x + 22, y - 14); ctx.stroke();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(x + 22, y - 12, 2, 0, Math.PI * 2); ctx.fill();
  ctx.lineCap = 'butt';
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${score}`, 16, 32);

  if (highScore > 0) {
    ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,215,0,0.7)';
    ctx.fillText(`Best: ${highScore}`, 16, 52);
  }

  // Kick hint
  if (state === 'playing' && frameCount < 300) {
    ctx.font = '13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - frameCount / 300)})`;
    ctx.textAlign = 'center';
    ctx.fillText('Space / Tap to Kick!', W / 2, H - 20);
    ctx.textAlign = 'left';
  }

  // Floating score texts
  ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const ft of floatingTexts) {
    ctx.globalAlpha = Math.max(0, ft.life);
    ctx.fillStyle = '#ffd700';
    ctx.fillText(ft.text, ft.x, ft.y);
    // Outline for readability
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function draw() {
  let shakeX = 0, shakeY = 0;
  if (shakeTimer > 0) {
    shakeTimer--;
    shakeX = (Math.random() - 0.5) * 8;
    shakeY = (Math.random() - 0.5) * 8;
  }

  ctx.save();
  ctx.translate(shakeX, shakeY);

  ctx.fillStyle = '#2d2d44';
  ctx.fillRect(-10, -10, W + 20, H + 20);

  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(0, 0, ROAD_LEFT - 4, H);
  ctx.fillRect(ROAD_RIGHT + 4, 0, W - ROAD_RIGHT, H);

  ctx.fillStyle = '#388e3c';
  for (let y = -40 + (roadMarkOffset * 2) % 30; y < H + 30; y += 30) {
    ctx.fillRect(0, y, ROAD_LEFT - 4, 10);
    ctx.fillRect(ROAD_RIGHT + 4, y, W - ROAD_RIGHT, 10);
  }

  drawRoad();

  for (const dog of dogs) {
    drawDog(dog);
  }

  if (state === 'playing' || state === 'dying' || state === 'gameover') {
    drawPlayer();
  }

  drawHUD();

  ctx.restore();
}

// --- Main loop ---
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
