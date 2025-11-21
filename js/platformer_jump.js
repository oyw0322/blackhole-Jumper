// -------------------------------------
// 캔버스
// -------------------------------------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// -------------------------------------
// 난이도 및 물리 설정 상수
// -------------------------------------
// 중력 증가
const BASE_PLAYER_GRAVITY = 0.5;
const GRAVITY_INCREASE_RATE_PER_SEC = 0.03;

// 블랙홀 인력 증가
const BASE_BLACKHOLE_STRENGTH = 200000;
const BLACKHOLE_STRENGTH_INCREASE_RATE_PER_SEC = 10000;

// 발판 속도 증가
const BASE_PLATFORM_FALL_SPEED = 2;
const FALL_SPEED_INCREASE_RATE_PER_SEC = 0.1;

// 발판 두께 감소
const BASE_PLATFORM_HEIGHT = 10;
const MAX_PLATFORM_THINNING = 7; 
const THINNING_DURATION_SECONDS = 60;

// 운석 설정
let asteroids = [];
const ASTEROID_MIN_SIZE = 10;
const ASTEROID_MAX_SIZE = 25;
const ASTEROID_BASE_SPEED = 4;
const ASTEROID_SPAWN_INTERVAL_MS = 2000;

// -------------------------------------
// 점프 시스템 설정 (점프 버그 수정)
// -------------------------------------
const COYOTE_TIME_FRAMES = 6; // 발판에서 떨어진 후 점프 가능 시간 (프레임)
let coyoteTimer = 0;

const JUMP_BUFFER_FRAMES = 8; // 착지 직전 점프 입력을 기억하는 시간 (프레임)
let jumpBufferTimer = 0; 


// -------------------------------------
// 게임 상태 변수
// -------------------------------------
let gameStarted = false;
let gameOver = false;
let platformInterval;
let asteroidInterval;
let startTime = Date.now();
let elapsedTime = 0;


// -------------------------------------
// 플레이어 설정
// -------------------------------------
let player = {
  x: canvas.width / 2 - 15,
  y: 20,
  width: 30,
  height: 30,
  vx: 0,
  vy: 0, 
  jumpPower: -12, 
  canJump: false 
};

// -------------------------------------
// 블랙홀 설정
// -------------------------------------
let blackhole = {
  x: canvas.width / 2,
  y: canvas.height + 200,
  radius: 250, 
};

// -------------------------------------
// 플랫폼 설정
// -------------------------------------
let platforms = [];
const platformWidth = 70;
const INITIAL_PLATFORMS = 6;
const SPAWN_INTERVAL_MS = 300; 

// -------------------------------------
// 헬퍼 함수
// -------------------------------------
function getCurrentPlatformHeight(timeFactor) {
    const thinningRatio = Math.min(timeFactor / THINNING_DURATION_SECONDS, 1.0);
    const newHeight = BASE_PLATFORM_HEIGHT - (MAX_PLATFORM_THINNING * thinningRatio);
    return Math.max(newHeight, BASE_PLATFORM_HEIGHT - MAX_PLATFORM_THINNING);
}


// -------------------------------------
// 게임 시작/종료 관리
// -------------------------------------
function startGame() {
    if (gameStarted || !player.canJump) return;
    
    gameStarted = true;
    startTime = Date.now();
    
    // 게임 시작 시에만 발판과 운석 생성을 시작
    platformInterval = setInterval(spawnPlatform, SPAWN_INTERVAL_MS);
    asteroidInterval = setInterval(spawnAsteroid, ASTEROID_SPAWN_INTERVAL_MS);
}

function stopGame(message) {
    if (gameOver) return;
    
    gameOver = true;
    clearInterval(platformInterval);
    clearInterval(asteroidInterval);

    setTimeout(() => {
      alert(message + " Time: " + elapsedTime + "초");
      document.location.reload();
    }, 30);
}


// -------------------------------------
// 입력 처리
// -------------------------------------
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;

  // 게임 시작 조건: 플레이어가 착지 상태일 때 방향키로 게임 시작
  if (!gameStarted && player.canJump && (e.code === "ArrowLeft" || e.code === "ArrowRight")) {
      startGame();
  }

  // Space: 점프 입력 버퍼 활성화 및 즉시 점프 시도
  if (e.code === "Space" || e.key === " ") {
      // 게임 시작 후 점프 입력 버퍼 타이머 설정
      if (gameStarted) {
          jumpBufferTimer = JUMP_BUFFER_FRAMES; 
      }
      
      // 즉시 점프 인가 (기존 로직)
      if (gameStarted && player.canJump) {
          player.vy = player.jumpPower;
          player.canJump = false;
          jumpBufferTimer = 0; // 즉시 점프했으면 버퍼 초기화
          coyoteTimer = 0;     // 점프했으니 코요테 타임도 소모
      }
  }
});
window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

// -------------------------------------
// 플랫폼 및 운석 생성
// -------------------------------------
function spawnInitialPlatforms() {
  platforms = [];
  const currentHeight = getCurrentPlatformHeight(0); 
  
  // 1. 플레이어 바로 밑에 시작 발판 생성
  const startPlatform = {
    x: player.x + player.width / 2 - platformWidth / 2, 
    y: player.y + player.height + 5,                    
    width: platformWidth,
    height: currentHeight, 
    speed: 0 
  };
  platforms.push(startPlatform);
  
  // 플레이어 위치를 시작 발판 위에 고정하여 착지 상태를 보장
  player.y = startPlatform.y - player.height;
  player.vy = 0;
  player.canJump = true; 
  
  for (let i = 0; i < INITIAL_PLATFORMS - 1; i++) { 
    const x = Math.random() * (canvas.width - platformWidth);
    const y = 60 + Math.random() * (canvas.height * 0.45);
    platforms.push({
      x,
      y,
      width: platformWidth,
      height: currentHeight, 
      speed: 0
    });
  }
}

function spawnPlatform() {
  const currentHeight = getCurrentPlatformHeight(parseFloat(elapsedTime)); 
  
  platforms.push({
    x: Math.random() * (canvas.width - platformWidth),
    y: -currentHeight, 
    width: platformWidth,
    height: currentHeight, 
    speed: 0 
  });
}

function spawnAsteroid() {
    const radius = Math.random() * (ASTEROID_MAX_SIZE - ASTEROID_MIN_SIZE) + ASTEROID_MIN_SIZE;
    const x = Math.random() * canvas.width;
    const y = -radius; 
    const vx = (Math.random() - 0.5) * 1.5; 
    
    asteroids.push({
        x: x,
        y: y,
        radius: radius,
        vx: vx,
        vy: ASTEROID_BASE_SPEED
    });
}


// -------------------------------------
// 업데이트 로직
// -------------------------------------

function updatePlayerPhysics() {
  // 좌우 이동
  if (keys["ArrowLeft"]) player.vx -= 0.4;
  if (keys["ArrowRight"]) player.vx += 0.4;

  // 게임 시작 후 물리 적용 (중력, 블랙홀)
  if (gameStarted) {
    const timeFactor = parseFloat(elapsedTime);
    const currentGravity = BASE_PLAYER_GRAVITY + timeFactor * GRAVITY_INCREASE_RATE_PER_SEC;
    player.vy += currentGravity;

    // 블랙홀 인력 계산
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    let dx = blackhole.x - px;
    let dy = blackhole.y - py;
    let distSq = dx * dx + dy * dy;
    if (distSq < 25 * 25) distSq = 25 * 25;

    const currentBlackholeStrength = BASE_BLACKHOLE_STRENGTH + timeFactor * BLACKHOLE_STRENGTH_INCREASE_RATE_PER_SEC;

    const force = currentBlackholeStrength / distSq;
    const dist = Math.sqrt(distSq);

    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;

    player.vx += fx * 0.01;
    player.vy += fy * 0.01;
  }
  
  // 속도 적용
  player.x += player.vx;
  player.y += player.vy;

  // 마찰감
  player.vx *= 0.98;
  player.vy *= 0.999;

  // 가로 경계 막기
  if (player.x < 0) {
    player.x = 0;
    player.vx = 0;
  } else if (player.x + player.width > canvas.width) {
    player.x = canvas.width - player.width;
    player.vx = 0;
  }
}

function updatePlatforms() {
    if (!gameStarted) return; 
    
    const timeFactor = parseFloat(elapsedTime);
    const currentFallSpeed = BASE_PLATFORM_FALL_SPEED + timeFactor * FALL_SPEED_INCREASE_RATE_PER_SEC;
    
  for (let i = platforms.length - 1; i >= 0; i--) {
    const p = platforms[i];
    p.y += currentFallSpeed;

    if (p.y > canvas.height + 50) {
      platforms.splice(i, 1);
    }
  }
}

function updateAsteroids() {
    if (!gameStarted) return;
    
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const a = asteroids[i];
        a.x += a.vx;
        a.y += a.vy;

        if (a.y > canvas.height + a.radius || a.x < -a.radius || a.x > canvas.width + a.radius) {
            asteroids.splice(i, 1);
        }
    }
}


// -------------------------------------
// 충돌 검사
// -------------------------------------

function checkPlatformCollision() {
  let landed = false;

  for (let p of platforms) {
    const collideX =
      player.x + player.width > p.x &&
      player.x < p.x + p.width;

    const playerBottom = player.y + player.height;

    // 견고한 Y축 충돌 검사 (터널링 방지)
    if (collideX && player.vy >= 0 && playerBottom >= p.y && player.y < p.y + p.height) {
      // 플랫폼 상단에 위치 고정 (스냅)
      player.y = p.y - player.height;
      player.vy = 0;
      landed = true;
      player.canJump = true; 
      coyoteTimer = COYOTE_TIME_FRAMES; // 착지 성공 시 코요테 타임 초기화 (풀 충전)
    }
  }

  // 공중일 때는 점프 불가
  if (!landed) {
    // 착지 실패 시 (공중에 있을 때), 코요테 타임을 사용하여 canJump 상태를 유지
    if (coyoteTimer <= 0) {
        player.canJump = false;
    }
  }

  // 점프 버퍼 적용: 착지 상태이거나 코요테 타임이 남아있고, 버퍼 타이머가 남아 있다면 점프 실행
  if ((player.canJump || coyoteTimer > 0) && jumpBufferTimer > 0) {
      player.vy = player.jumpPower;
      player.canJump = false;
      jumpBufferTimer = 0; // 점프 소모 후 버퍼 타이머 초기화
      coyoteTimer = 0;     // 점프했으니 코요테 타임도 소모
  }
}

function checkAsteroidCollision() {
    if (gameOver || !gameStarted) return false;

    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;

    for (let a of asteroids) {
        const ax = a.x;
        const ay = a.y;
        const ar = a.radius;

        const dx = ax - px;
        const dy = ay - py;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < ar + player.width / 2) { 
            stopGame("Game Over! (운석 충돌)");
            return true;
        }
    }
    return false;
}


function checkBlackhole() {
  if (gameOver || !gameStarted) return true;

  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;

  const dx = px - blackhole.x;
  const dy = blackhole.y - py;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < blackhole.radius * 1.0) {
    stopGame("Game Over! (블랙홀 흡수)");
    return true;
  }
  return false;
}


// -------------------------------------
// 그리기
// -------------------------------------
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 배경: 짙은 회색으로 변경하여 블랙홀 대비 증가
  ctx.fillStyle = "#141414"; // ▼ 수정됨
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 플랫폼
  ctx.fillStyle = "#4de06a";
  platforms.forEach((p) => ctx.fillRect(p.x, p.y, p.width, p.height)); 

  // 운석 그리기
  ctx.fillStyle = "#8d8d8d"; 
  asteroids.forEach((a) => {
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  // 플레이어
  ctx.fillStyle = "#55e6ff";
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // 블랙홀 (아래쪽)
  const grad = ctx.createRadialGradient(
    blackhole.x, blackhole.y, 20,
    blackhole.x, blackhole.y, blackhole.radius
  );
  grad.addColorStop(0, "rgba(0,0,0,1)");
  grad.addColorStop(0.6, "rgba(80,0,120,0.6)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.arc(blackhole.x, blackhole.y, blackhole.radius, 0, Math.PI * 2);
  ctx.fill();
    
  // ▼ 추가: 블랙홀 경계선 그리기
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"; // 투명한 흰색 테두리
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(blackhole.x, blackhole.y, blackhole.radius, 0, Math.PI * 2);
  ctx.stroke();

  // 시간 및 시작 메시지
  ctx.fillStyle = "white";
  ctx.font = "18px sans-serif";
  ctx.fillText("Time: " + elapsedTime + "s", 10, 26);
    
  if (!gameStarted && !gameOver) {
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    
    if (player.canJump) {
        ctx.fillText("Press ← or → to Start", canvas.width / 2, canvas.height / 2);
    } else {
        ctx.fillText("...Loading...", canvas.width / 2, canvas.height / 2);
    }
    ctx.textAlign = "left";
  }
}

// -------------------------------------
// 메인 루프
// -------------------------------------
function update() {
  if (gameOver) return;
  
  // 게임이 시작되었을 때 타이머 업데이트
  if (gameStarted) {
    elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1); 
    
    // 점프 시스템 타이머 업데이트 (코요테/버퍼)
    if (coyoteTimer > 0) coyoteTimer--;
    if (jumpBufferTimer > 0) jumpBufferTimer--;
  }
  
  // 플레이어 물리 및 충돌은 항상 확인 (초기 착지 유지 및 이동 감지)
  checkPlatformCollision();
  updatePlayerPhysics();
  
  // 발판 및 운석은 gameStarted일 때만 업데이트 및 충돌 검사
  if (gameStarted) {
    updatePlatforms();
    updateAsteroids(); 
    
    if (checkAsteroidCollision() || checkBlackhole()) {
        return; 
    }
  }

  draw();

  requestAnimationFrame(update);
}

// -------------------------------------
// 초기화
// -------------------------------------
spawnInitialPlatforms(); 
update();