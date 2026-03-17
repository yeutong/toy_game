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

// --- State ---
let state = 'title'; // title | playing | gameover
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

// --- Helpers ---
function laneX(lane) {
  return ROAD_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// --- Input ---
let inputLeft = false;
let inputRight = false;

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (state !== 'playing') startGame();
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
  if (state !== 'playing') { startGame(); return; }
  touchStartX = e.touches[0].clientX;
});
canvas.addEventListener('touchend', (e) => {
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 20) {
    movePlayer(dx > 0 ? 1 : -1);
  }
  touchStartX = null;
});
canvas.addEventListener('click', () => {
  if (state !== 'playing') startGame();
});

function movePlayer(dir) {
  const newLane = playerLane + dir;
  if (newLane >= 0 && newLane < LANE_COUNT) {
    playerLane = newLane;
    playerTargetX = laneX(playerLane);
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
  overlay.classList.add('hidden');
}

function gameOver() {
  state = 'gameover';
  shakeTimer = 20;
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
  // Avoid spawning on top of existing dogs in same lane
  const tooClose = dogs.some(d => d.lane === lane && d.y < 60);
  if (tooClose) return;
  dogs.push({ lane, x: laneX(lane), y: -DOG_H });
}

function update() {
  if (state !== 'playing') return;

  frameCount++;
  score = Math.floor(frameCount / 6);

  // Speed up over time
  roadSpeed = Math.min(ROAD_SPEED_MAX, ROAD_SPEED_INITIAL + frameCount * ROAD_ACCEL);
  spawnInterval = Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_INITIAL - frameCount * 0.02);

  // Spawn dogs
  spawnTimer++;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnDog();
  }

  // Move dogs
  for (const dog of dogs) {
    dog.y += roadSpeed;
  }
  // Remove off-screen dogs
  dogs = dogs.filter(d => d.y < H + 50);

  // Smooth player movement
  playerX = lerp(playerX, playerTargetX, 0.2);

  // Collision detection
  for (const dog of dogs) {
    const dx = Math.abs(playerX - dog.x);
    const dy = Math.abs(playerY - dog.y);
    if (dx < (PLAYER_SIZE / 2 + DOG_W / 2 - 6) && dy < (PLAYER_SIZE / 2 + DOG_H / 2 - 4)) {
      gameOver();
      return;
    }
  }

  // Road markings scroll
  roadMarkOffset = (roadMarkOffset + roadSpeed) % 40;
}

// --- Drawing ---
function drawRoad() {
  // Road background
  ctx.fillStyle = '#3a3a4a';
  ctx.fillRect(ROAD_LEFT, 0, LANE_COUNT * LANE_WIDTH, H);

  // Road edges
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(ROAD_LEFT - 4, 0, 4, H);
  ctx.fillRect(ROAD_RIGHT, 0, 4, H);

  // Lane dividers (dashed)
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
  ctx.fillRect(x - 3, y - s / 2 + 4, 2, 2);
  ctx.fillRect(x + 1, y - s / 2 + 4, 2, 2);

  // Legs (animated)
  const legAnim = Math.sin(frameCount * 0.3) * 3;
  ctx.fillStyle = '#333';
  ctx.fillRect(x - 5, y + s / 2 - 4, 4, 6 + legAnim);
  ctx.fillRect(x + 1, y + s / 2 - 4, 4, 6 - legAnim);
}

function drawDog(dog) {
  const x = dog.x;
  const y = dog.y;

  // Body
  ctx.fillStyle = '#8d6e63';
  ctx.beginPath();
  ctx.ellipse(x, y, DOG_W / 2, DOG_H / 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#a1887f';
  ctx.beginPath();
  ctx.ellipse(x, y - DOG_H / 2, 10, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = '#6d4c41';
  ctx.beginPath();
  ctx.ellipse(x - 8, y - DOG_H / 2 - 4, 5, 7, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 8, y - DOG_H / 2 - 4, 5, 7, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(x - 4, y - DOG_H / 2 - 1, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 4, y - DOG_H / 2 - 1, 2, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.ellipse(x, y - DOG_H / 2 + 5, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  const legAnim = Math.sin(frameCount * 0.4 + dog.y) * 2;
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(x - DOG_W / 2 + 3, y + DOG_H / 2.5 - 2, 5, 8 + legAnim);
  ctx.fillRect(x - DOG_W / 2 + 12, y + DOG_H / 2.5 - 2, 5, 8 - legAnim);
  ctx.fillRect(x + DOG_W / 2 - 8, y + DOG_H / 2.5 - 2, 5, 8 + legAnim);
  ctx.fillRect(x + DOG_W / 2 - 17, y + DOG_H / 2.5 - 2, 5, 8 - legAnim);

  // Tail
  ctx.strokeStyle = '#6d4c41';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const tailWag = Math.sin(frameCount * 0.2 + dog.y) * 5;
  ctx.beginPath();
  ctx.moveTo(x, y + DOG_H / 2.5 - 2);
  ctx.quadraticCurveTo(x + tailWag, y + DOG_H / 2.5 + 6, x + tailWag + 3, y + DOG_H / 2.5 + 2);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawHUD() {
  // Score
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${score}`, 16, 32);

  // High score
  if (highScore > 0) {
    ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,215,0,0.7)';
    ctx.fillText(`Best: ${highScore}`, 16, 52);
  }
}

function draw() {
  // Screen shake
  let shakeX = 0, shakeY = 0;
  if (shakeTimer > 0) {
    shakeTimer--;
    shakeX = (Math.random() - 0.5) * 8;
    shakeY = (Math.random() - 0.5) * 8;
  }

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Background
  ctx.fillStyle = '#2d2d44';
  ctx.fillRect(-10, -10, W + 20, H + 20);

  // Grass sides
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(0, 0, ROAD_LEFT - 4, H);
  ctx.fillRect(ROAD_RIGHT + 4, 0, W - ROAD_RIGHT, H);

  // Grass stripes
  ctx.fillStyle = '#388e3c';
  for (let y = -40 + (roadMarkOffset * 2) % 30; y < H + 30; y += 30) {
    ctx.fillRect(0, y, ROAD_LEFT - 4, 10);
    ctx.fillRect(ROAD_RIGHT + 4, y, W - ROAD_RIGHT, 10);
  }

  drawRoad();

  for (const dog of dogs) {
    drawDog(dog);
  }

  if (state === 'playing' || state === 'gameover') {
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
