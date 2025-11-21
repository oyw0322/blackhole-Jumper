// -------------------------------------
// 캔버스
// -------------------------------------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");


// -------------------------------------
// 난이도 및 물리 설정 상수
// -------------------------------------
const BASE_PLAYER_GRAVITY = 0.5;
const GRAVITY_INCREASE_RATE_PER_SEC = 0.001;
const BASE_BLACKHOLE_STRENGTH = 200000;
const BLACKHOLE_STRENGTH_INCREASE_RATE_PER_SEC = 25000;
const BASE_PLATFORM_FALL_SPEED = 3;
const FALL_SPEED_INCREASE_RATE_PER_SEC = 0.05;
const BASE_PLATFORM_HEIGHT = 10;
const MAX_PLATFORM_THINNING = 7; 
const THINNING_DURATION_SECONDS = 30;

// 운석 설정
let asteroids = [];
const ASTEROID_MIN_SIZE = 10;
const ASTEROID_MAX_SIZE = 25;
const ASTEROID_BASE_SPEED = 4;
const ASTEROID_MIN_INTERVAL_MS = 3000; // 랜덤 소환: 최소 3초
const ASTEROID_MAX_INTERVAL_MS = 5000; // 랜덤 소환: 최대 5초

// 쉴드 아이템 설정
const SHIELD_SPAWN_INTERVAL_MS = 10000; // 15초마다 쉴드 소환 시도
const SHIELD_SIZE = 25; // 아이템 크기
const SHIELD_PLAYER_EFFECT_FRAMES = 30; // 쉴드 소모 후 플레이어 깜빡임 지속 시간

// -------------------------------------
// 점프 시스템 설정
// -------------------------------------
const COYOTE_TIME_FRAMES = 6; 
let coyoteTimer = 0;
const JUMP_BUFFER_FRAMES = 8; 
let jumpBufferTimer = 0; 


// -------------------------------------
// 게임 상태 변수
// -------------------------------------
let gameStarted = false;
let gameOver = false;
let platformInterval;
let asteroidInterval; // setTimeout ID를 저장
let shieldSpawnInterval; // setInterval ID를 저장

let startTime = Date.now();
let elapsedTime = 0;
let imagesLoaded = 0; 
const totalImagesToLoad = 3; 

// 최고 기록 변수
let currentBestTime = 0; 
const HIGH_SCORE_KEY = "BlackholeJumperHighScore"; 

// 쉴드 아이템 변수
let shieldItem = null; // 현재 맵에 존재하는 쉴드 아이템 객체

// ★ Delta Time 변수 추가 ★
let lastTime = 0;
let deltaTime = 0;


// -------------------------------------
// 디자인 변수
// -------------------------------------
let stars = [];
const NUM_STARS = 150;
const PLATFORM_HIT_FRAMES = 10; 
const GRAVITY_LENS_RADIUS_FACTOR = 1.5; 
const GRAVITY_LENS_STRENGTH = 10;      

// -------------------------------------
// 이미지 객체 
// -------------------------------------
function initStars() {
    for (let i = 0; i < NUM_STARS; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 1.5,
            speed: Math.random() * 0.3 + 0.1 
        });
    }
}

function checkAllImagesLoaded() {
    if (imagesLoaded === totalImagesToLoad) {
        console.log("All necessary assets loaded. Starting game loop.");
        
        loadHighScore(); 
        
        initStars(); 
        spawnInitialPlatforms(); 
        player.canJump = true; 
        // ★ update 함수 호출 시 인자 없이 초기 호출 ★
        update(); 
    }
}

const playerImage = new Image();
playerImage.src = 'images/player.jpg'; 
playerImage.onload = () => {
    imagesLoaded++;
    checkAllImagesLoaded();
};
playerImage.onerror = () => {
    console.error("Failed to load images/player.jpg. Proceeding without image.");
    imagesLoaded++; 
    checkAllImagesLoaded();
};

const asteroidImage = new Image();
asteroidImage.src = 'images/meteor.jpg'; 
asteroidImage.onload = () => {
    imagesLoaded++;
    checkAllImagesLoaded();
};
asteroidImage.onerror = () => {
    console.error("Failed to load images/meteor.jpg. Proceeding without image.");
    imagesLoaded++;
    checkAllImagesLoaded();
};

const platformImage = new Image();
platformImage.src = 'images/step.jpg'; 
platformImage.onload = () => {
    imagesLoaded++;
    checkAllImagesLoaded();
};
platformImage.onerror = () => {
    console.error("Failed to load images/step.jpg. Proceeding with default platform.");
    imagesLoaded++;
    checkAllImagesLoaded();
};


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
  jumpPower: -16, 
  canJump: false,
  hasShield: false, // 쉴드 소지 여부
  shieldHitTimer: 0 // 쉴드 소모 후 피격 애니메이션 타이머
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
const SPAWN_INTERVAL_MS = 280; 

// -------------------------------------
// 헬퍼 함수
// -------------------------------------
function getCurrentPlatformHeight(timeFactor) {
    const thinningRatio = Math.min(timeFactor / THINNING_DURATION_SECONDS, 1.0);
    const newHeight = BASE_PLATFORM_HEIGHT - (MAX_PLATFORM_THINNING * thinningRatio);
    return Math.max(newHeight, BASE_PLATFORM_HEIGHT - MAX_PLATFORM_THINNING);
}

// 중력 렌즈 효과를 계산하는 함수
function getLensedPosition(objX, objY) {
    const bhX = blackhole.x;
    const bhY = blackhole.y;
    const bhRadius = blackhole.radius;

    const dx = objX - bhX;
    const dy = objY - bhY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > bhRadius * GRAVITY_LENS_RADIUS_FACTOR) {
        return { x: objX, y: objY };
    }

    const distortionFactor = 1 - (dist / (bhRadius * GRAVITY_LENS_RADIUS_FACTOR)); 
    
    const newDx = dx * (1 - (GRAVITY_LENS_STRENGTH * distortionFactor) / dist);
    const newDy = dy * (1 - (GRAVITY_LENS_STRENGTH * distortionFactor) / dist);
    
    return { x: bhX + newDx, y: bhY + newDy };
}

// 최고 기록 헬퍼 함수
 function loadHighScore() {
    const savedScore = localStorage.getItem(HIGH_SCORE_KEY);
    if (savedScore) {
        currentBestTime = parseFloat(savedScore); 
    }
} 

function saveHighScore(newTime) {
    if (newTime > currentBestTime) {
        currentBestTime = newTime;
        localStorage.setItem(HIGH_SCORE_KEY, newTime.toFixed(1));
        return true; 
    }
    return false; 
}

// -------------------------------------
// 타이머 관리 헬퍼 함수 (프레임 독립성 유지)
// -------------------------------------

function clearGameTimers() {
    if (platformInterval !== undefined) clearInterval(platformInterval);
    if (asteroidInterval !== undefined) clearTimeout(asteroidInterval);
    if (shieldSpawnInterval !== undefined) clearInterval(shieldSpawnInterval);
    
    platformInterval = null;
    asteroidInterval = null;
    shieldSpawnInterval = null;
}

function restartGameTimers() {
    if (!gameStarted || gameOver) return;
    
    // 1. 플랫폼 타이머 재시작
    if (!platformInterval) {
        platformInterval = setInterval(spawnPlatform, SPAWN_INTERVAL_MS);
    }
    
    // 2. 운석 타이머 재시작
    if (!asteroidInterval) {
        scheduleNextAsteroidSpawn(); 
    }
    
    // 3. 쉴드 타이머 재시작
    if (!shieldSpawnInterval) {
        shieldSpawnInterval = setInterval(spawnShieldItem, SHIELD_SPAWN_INTERVAL_MS);
    }
}


// -------------------------------------
// 게임 시작/종료 관리
// -------------------------------------
function startGame() {
    if (gameStarted || !player.canJump) return;
    
    gameStarted = true;
    startTime = Date.now();
    
    restartGameTimers(); 
}

function stopGame(message) {
    if (gameOver) return;
    
    gameOver = true;
    
    clearGameTimers(); 


    const finalTime = parseFloat(elapsedTime);
    const isNewRecord = saveHighScore(finalTime);
    
    let alertMessage = message + "\n\n";
    alertMessage += "최종 생존 시간: " + finalTime.toFixed(1) + "초\n";
    alertMessage += "최고 기록: " + currentBestTime.toFixed(1) + "초";

    if (isNewRecord) {
        alertMessage += " (🎉 NEW RECORD!)";
    }

    setTimeout(() => {
      alert(alertMessage);
      document.location.reload();
    }, 30);
}


// -------------------------------------
// 입력 처리
// -------------------------------------
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
    
  // 스크롤 방지 로직 
  if (
      e.code === "Space" || 
      e.code === "ArrowUp" || 
      e.code === "ArrowDown"
  ) {
      e.preventDefault();
  }

  // 게임 시작 조건
  if (!gameStarted && player.canJump && (e.code === "ArrowLeft" || e.code === "ArrowRight")) {
      startGame();
  }

  if (e.code === "Space" || e.key === " ") {
      if (gameStarted) {
          jumpBufferTimer = JUMP_BUFFER_FRAMES; 
      }
      
      if ((gameStarted && player.canJump) || (gameStarted && coyoteTimer > 0)) {
          player.vy = player.jumpPower;
          player.canJump = false;
          jumpBufferTimer = 0; 
          coyoteTimer = 0; 
      }
  }
});
window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

// -------------------------------------
// 플랫폼, 운석, 쉴드 생성
// -------------------------------------
function spawnInitialPlatforms() {
  platforms = [];
  const currentHeight = getCurrentPlatformHeight(0); 
  
  const startPlatform = {
    x: player.x + player.width / 2 - platformWidth / 2, 
    y: player.y + player.height + 5,                    
    width: platformWidth,
    height: currentHeight, 
    speed: 0,
    hitTimer: 0 
  };
  platforms.push(startPlatform);
  
  player.y = startPlatform.y - player.height;
  player.vy = 0;
  
  for (let i = 0; i < INITIAL_PLATFORMS - 1; i++) { 
    const x = Math.random() * (canvas.width - platformWidth);
    const y = 60 + Math.random() * (canvas.height * 0.45);
    platforms.push({
      x,
      y,
      width: platformWidth,
      height: currentHeight, 
      speed: 0,
      hitTimer: 0 
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
    speed: 0,
    hitTimer: 0 
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

// 랜덤 운석 소환 예약 함수
function scheduleNextAsteroidSpawn() {
    if (gameOver) return;

    const min = ASTEROID_MIN_INTERVAL_MS;
    const max = ASTEROID_MAX_INTERVAL_MS;
    const randomInterval = Math.random() * (max - min) + min;

    asteroidInterval = setTimeout(() => {
        spawnAsteroid();
        scheduleNextAsteroidSpawn(); 
    }, randomInterval);
}

// 쉴드 아이템 생성 함수
function spawnShieldItem() {
    if (shieldItem !== null) return; 

    shieldItem = {
        x: Math.random() * (canvas.width - SHIELD_SIZE),
        y: -SHIELD_SIZE,
        radius: SHIELD_SIZE / 2,
    };
}


// -------------------------------------
// 업데이트 로직
// -------------------------------------

function updatePlayerPhysics() {
  // 이동 속도 변화는 프레임에 종속되지 않게 상수값으로 유지
  if (keys["ArrowLeft"]) player.vx -= 0.3;
  if (keys["ArrowRight"]) player.vx += 0.3;

  if (gameStarted) {
    const timeFactor = parseFloat(elapsedTime);
    const currentGravity = BASE_PLAYER_GRAVITY + timeFactor * GRAVITY_INCREASE_RATE_PER_SEC;
    
    // ★ 중력 적용에 deltaTime 사용 ★
    player.vy += currentGravity * deltaTime * 60; // 초당 60프레임 기준으로 보정

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

    // ★ 블랙홀 인력 적용에 deltaTime 사용 ★
    player.vx += fx * 0.01 * deltaTime * 60; // 초당 60프레임 기준으로 보정
    player.vy += fy * 0.01 * deltaTime * 60; // 초당 60프레임 기준으로 보정
  }
  
  // ★ 최종 위치 업데이트에도 deltaTime 사용 ★
  player.x += player.vx * deltaTime * 60;
  player.y += player.vy * deltaTime * 60;

  // 마찰력 (감속)은 프레임에 독립적이지 않게 상수로 유지
  player.vx *= 0.98;
  player.vy *= 0.999;

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
    
    // ★ 플랫폼 하강에 deltaTime 사용 ★
    p.y += currentFallSpeed * deltaTime * 60;
    
    // hitTimer는 프레임 카운트 기준으로 유지 (deltaTime 적용 시 복잡해짐)
    if (p.hitTimer > 0) p.hitTimer--;

    if (p.y > canvas.height + 50) {
      platforms.splice(i, 1);
    }
  }
}

function updateAsteroids() {
    if (!gameStarted) return;
    
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const a = asteroids[i];
        
        // ★ 운석 이동에 deltaTime 사용 ★
        a.x += a.vx * deltaTime * 60;
        a.y += a.vy * deltaTime * 60;

        if (a.y > canvas.height + a.radius || a.x < -a.radius || a.x > canvas.width + a.radius) {
            asteroids.splice(i, 1);
        }
    }
}

// 쉴드 아이템 움직임 업데이트 함수
function updateShieldItem() {
    if (shieldItem === null || !gameStarted) return;
    
    const timeFactor = parseFloat(elapsedTime);
    const currentFallSpeed = BASE_PLATFORM_FALL_SPEED + timeFactor * FALL_SPEED_INCREASE_RATE_PER_SEC;

    // ★ 쉴드 아이템 하강에 deltaTime 사용 ★
    shieldItem.y += currentFallSpeed * deltaTime * 60;

    if (shieldItem.y > canvas.height + SHIELD_SIZE) {
        shieldItem = null;
    }
}


// -------------------------------------
// 충돌 검사 (생략)
// -------------------------------------
// ... (checkPlatformCollision, checkShieldItemCollision, checkAsteroidCollision, checkBlackhole 함수는 변경 없음) ...
function checkPlatformCollision() {
    // ... (기존 플랫폼 충돌 로직 유지) ...
  let landed = false;

  for (let p of platforms) {
    const collideX =
      player.x + player.width > p.x &&
      player.x < p.x + p.width;

    const playerBottom = player.y + player.height;

    if (collideX && player.vy >= 0 && playerBottom >= p.y && player.y < p.y + p.height) {
      player.y = p.y - player.height;
      player.vy = 0;
      landed = true;
      player.canJump = true; 
      coyoteTimer = COYOTE_TIME_FRAMES; 
      p.hitTimer = PLATFORM_HIT_FRAMES; 
    }
  }

  if (!landed) {
    if (coyoteTimer <= 0) {
        player.canJump = false;
    }
  }
  
  // coyoteTimer와 jumpBufferTimer는 update 함수에서 deltaTime으로 감소시키므로 여기서는 조정 로직만 남김
  if ((player.canJump || coyoteTimer > 0) && jumpBufferTimer > 0) {
      player.vy = player.jumpPower;
      player.canJump = false;
      jumpBufferTimer = 0; 
      coyoteTimer = 0; 
  }
}

function checkShieldItemCollision() {
    if (shieldItem === null) return;
    const pX = player.x + player.width / 2;
    const pY = player.y + player.height / 2;
    const sX = shieldItem.x + shieldItem.radius;
    const sY = shieldItem.y + shieldItem.radius;
    const dx = sX - pX;
    const dy = sY - pY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < shieldItem.radius + player.width / 2) {
        player.hasShield = true;
        shieldItem = null;
    }
}

function checkAsteroidCollision() {
    if (gameOver || !gameStarted) return false;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    for (let i = asteroids.length - 1; i >= 0; i--) { 
        const a = asteroids[i];
        const ax = a.x;
        const ay = a.y;
        const ar = a.radius;
        const dx = ax - px;
        const dy = ay - py;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < ar + player.width / 2) { 
            if (player.hasShield) {
                player.hasShield = false;
                player.shieldHitTimer = SHIELD_PLAYER_EFFECT_FRAMES;
                asteroids.splice(i, 1);
                return false;
            } else {
                stopGame("Game Over! (운석과(와) 출동하였습니다.)");
                return true;
            }
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
        stopGame("Game Over! (블랙홀에 빨려들어갔습니다.)");
        return true;
    }
    return false;
}


// -------------------------------------
// 그리기 (생략)
// -------------------------------------
// ... (draw 함수는 변경 없음) ...
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#141414"; 
  ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. 별 그리기 및 움직임 (중력 렌즈 효과 적용)
    stars.forEach(star => {
        const lensedPos = getLensedPosition(star.x, star.y);

        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(lensedPos.x, lensedPos.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
        
        if (gameStarted) {
            // 별 움직임도 deltaTime을 곱해야 정확하지만, 배경 효과이므로 단순화를 위해 기존 로직 유지
            star.y += star.speed;
            if (star.y > canvas.height) {
                star.y = 0; 
                star.x = Math.random() * canvas.width;
            }
        }
    });


  // 2. 플랫폼 그리기 (이미지 및 중력 렌즈 효과 적용)
  platforms.forEach((p) => {
        const lensedPosTopLeft = getLensedPosition(p.x, p.y);
        const lensedPosBottomRight = getLensedPosition(p.x + p.width, p.y + p.height);
        
        const lensedWidth = lensedPosBottomRight.x - lensedPosTopLeft.x;
        const lensedHeight = lensedPosBottomRight.y - lensedPosTopLeft.y;

        if (platformImage.complete && platformImage.naturalWidth !== 0) {
            ctx.drawImage(platformImage, lensedPosTopLeft.x, lensedPosTopLeft.y, lensedWidth, lensedHeight);
            
            if (p.hitTimer > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${p.hitTimer / PLATFORM_HIT_FRAMES * 0.5})`; 
                ctx.fillRect(lensedPosTopLeft.x, lensedPosTopLeft.y, lensedWidth, lensedHeight);
            }
            
        } else {
            if (p.hitTimer > 0) {
                ctx.fillStyle = "#a8ffb8"; 
            } else {
                ctx.fillStyle = "#4de06a"; 
            }
            ctx.fillRect(lensedPosTopLeft.x, lensedPosTopLeft.y, lensedWidth, lensedHeight);
        }
    });

    // 쉴드 아이템 그리기
    if (shieldItem !== null) {
        ctx.fillStyle = "deepskyblue"; 
        ctx.beginPath();
        ctx.arc(shieldItem.x + shieldItem.radius, shieldItem.y + shieldItem.radius, shieldItem.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = "white";
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("S", shieldItem.x + shieldItem.radius, shieldItem.y + shieldItem.radius + 7);
        ctx.textAlign = "left"; 
    }

  // 3. 운석 그리기
    asteroids.forEach((a) => {
        if (asteroidImage.complete && asteroidImage.naturalWidth !== 0) {
            ctx.drawImage(asteroidImage, a.x - a.radius, a.y - a.radius, a.radius * 2, a.radius * 2);
        } else {
            ctx.fillStyle = "#8d8d8d"; 
            ctx.beginPath();
            ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    });

  // 4. 플레이어 그리기
    if (playerImage.complete && playerImage.naturalWidth !== 0) {
        ctx.drawImage(playerImage, player.x, player.y, player.width, player.height);
    } else {
        ctx.fillStyle = "#55e6ff";
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }
    
    // 플레이어 쉴드 효과 그리기
    if (player.hasShield) {
        ctx.strokeStyle = "rgba(0, 255, 255, 0.8)"; 
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width * 0.7, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // 쉴드 피격 후 깜빡임 효과
    if (player.shieldHitTimer > 0) {
        player.shieldHitTimer--;
        if (player.shieldHitTimer % 6 < 3) {
             ctx.fillStyle = "rgba(255, 0, 0, 0.5)"; 
             ctx.fillRect(player.x, player.y, player.width, player.height);
        }
    }


  // 5. 블랙홀 (아래쪽)
  const grad = ctx.createRadialGradient(
    blackhole.x, blackhole.y, 20,
    blackhole.x, blackhole.y, blackhole.radius
  );
  grad.addColorStop(0.0, "rgba(0,0,0,1)");     
  grad.addColorStop(0.6, "rgba(255, 50, 0, 0.8)"); 
  grad.addColorStop(0.8, "rgba(255, 180, 0, 0.5)"); 
  grad.addColorStop(1.0, "rgba(0,0,0,0)");    
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.arc(blackhole.x, blackhole.y, blackhole.radius, 0, Math.PI * 2);
  ctx.fill();
    
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"; 
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(blackhole.x, blackhole.y, blackhole.radius, 0, Math.PI * 2);
  ctx.stroke();

  // 6. 시간 및 최고 기록 표시
  ctx.fillStyle = "white";
  ctx.font = "18px sans-serif";
  ctx.fillText("Time: " + elapsedTime + "s", 10, 26); 
    
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffdd57"; 
  ctx.fillText("Best: " + currentBestTime.toFixed(1) + "s", canvas.width - 10, 26);
  ctx.textAlign = "left"; 

  if (!gameStarted && !gameOver) {
    ctx.font = "bold 24px sans-serif"; 
    ctx.textAlign = "center";
    
    const startText = "Press ← or → to Start";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    ctx.strokeText(startText, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = "white";
    
    if (imagesLoaded === totalImagesToLoad) {
        ctx.fillText(startText, canvas.width / 2, canvas.height / 2);
    } else {
        ctx.fillText("...Loading Images...", canvas.width / 2, canvas.height / 2);
    }
    ctx.textAlign = "left";
  }
}


// -------------------------------------
// 메인 루프 (Delta Time 적용)
// -------------------------------------
function update(currentTime) { // ★ currentTime 인자 추가 ★
  if (gameOver) return;
  
  // 1. Delta Time 계산 ★
  if (lastTime) {
      // ms 단위를 초(s) 단위로 변환
      deltaTime = (currentTime - lastTime) / 1000;
  } else {
      // 첫 프레임이거나 탭에서 돌아왔을 때 큰 deltaTime 방지
      deltaTime = 1 / 60; 
  }
  lastTime = currentTime;

  if (gameStarted) {
    elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1); 
    
    // ★ deltaTime 기반 타이머 감소 (60FPS 기준 시간 비율 사용) ★
    const timeFactor = deltaTime / (1/60); 

    if (coyoteTimer > 0) coyoteTimer -= timeFactor;
    if (jumpBufferTimer > 0) jumpBufferTimer -= timeFactor;
    
    // 타이머 값이 음수가 되는 것을 방지
    if (coyoteTimer < 0) coyoteTimer = 0;
    if (jumpBufferTimer < 0) jumpBufferTimer = 0;
  }
  
  checkPlatformCollision();
  updatePlayerPhysics();
  
  if (gameStarted) {
    updatePlatforms(); 
    updateAsteroids(); 
    
    // 아이템 업데이트 및 획득 검사
    updateShieldItem(); 
    checkShieldItemCollision();
    
    if (checkAsteroidCollision() || checkBlackhole()) {
        return; 
    }
  }

  draw();

  requestAnimationFrame(update);
}


// -------------------------------------
// 탭 가시성(Visibility) 감지 및 타이머 관리 리스너 (유지)
// -------------------------------------
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        clearGameTimers();
    } else {
        if (gameStarted && !gameOver) {
            // 경과 시간을 보존하면서 startTime을 재설정
            startTime = Date.now() - (parseFloat(elapsedTime) * 1000); 
            // deltaTime 계산을 위해 lastTime 초기화
            lastTime = 0; 
            restartGameTimers(); 
        }
    }
});