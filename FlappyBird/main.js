(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const btnStart = document.getElementById("btn-start");
  const btnPause = document.getElementById("btn-pause");

  // Logical canvas size (CSS scales visually)
  const WIDTH = 400, HEIGHT = 600;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = WIDTH * DPR;
  canvas.height = HEIGHT * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // Game state
  let state = "menu"; // menu | play | over | paused
  let last = 0;
  let score = 0;
  let best = parseInt(localStorage.getItem("flappy_best") || "0");
  let pipes = [];
  let spawnTimer = 0;
  let paused = false;

  // World
  const groundH = 90;
  const pipeW = 64;
  const initialGap = 150;
  let gap = initialGap;
  const pipeSpeed = 2.2; // px per frame @ 60fps (scaled by dt)
  const gravity = 0.5;
  const flapVy = -8.8;

  // Bird
  const bird = {
    x: 80,
    y: HEIGHT / 2,
    vy: 0,
    r: 12,
  };

  function reset() {
    state = "menu";
    score = 0;
    gap = initialGap;
    bird.y = HEIGHT / 2;
    bird.vy = 0;
    pipes = [];
    spawnTimer = 0;
    paused = false;
  }

  function startGame() {
    if (state === "play") return;
    state = "play";
    score = 0;
    gap = initialGap;
    bird.y = HEIGHT / 2;
    bird.vy = 0;
    pipes = [];
    spawnTimer = 0;
  }

  function gameOver() {
    state = "over";
    best = Math.max(best, score);
    localStorage.setItem("flappy_best", String(best));
  }

  function flap() {
    if (state === "menu") startGame();
    else if (state === "over") startGame();
    bird.vy = flapVy;
  }

  // Spawn a pipe pair
  function spawnPipePair() {
    const margin = 50;
    const y = Math.floor(Math.random() * (HEIGHT - groundH - margin*2 - gap)) + margin + gap/2;
    pipes.push({
      x: WIDTH + 2,
      yCenter: y,
      passed: false,
    });
  }

  // Inputs
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      flap();
    } else if (e.code === "KeyP") {
      if (state === "play") { paused = !paused; state = paused ? "paused" : "play"; }
      else if (state === "paused") { paused = false; state = "play"; }
    } else if (e.code === "KeyR") {
      reset(); startGame();
    }
  });
  canvas.addEventListener("mousedown", flap, {passive:true});
  canvas.addEventListener("touchstart", flap, {passive:true});
  btnStart.addEventListener("click", () => { reset(); startGame(); });
  btnPause.addEventListener("click", () => {
    if (state === "play") { paused = true; state = "paused"; }
    else if (state === "paused") { paused = false; state = "play"; }
  });

  // Helpers
  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function update(dt) {
    if (state !== "play") return;

    // Increase difficulty slowly
    gap = Math.max(110, gap - dt * 0.003); // shrink ~ over time
    const speed = pipeSpeed * dt * 60 / 1000;

    // Bird physics
    bird.vy += gravity * dt * 60 / 1000;
    bird.y += bird.vy * dt * 60 / 1000;

    // Ground collision
    if (bird.y + bird.r > HEIGHT - groundH) {
      bird.y = HEIGHT - groundH - bird.r;
      gameOver();
    }
    // Ceiling clamp
    if (bird.y - bird.r < 0) bird.y = bird.r;

    // Pipes
    spawnTimer += dt;
    if (spawnTimer > 1300) {
      spawnTimer = 0;
      spawnPipePair();
    }

    for (let i = pipes.length - 1; i >= 0; i--) {
      const p = pipes[i];
      p.x -= speed;

      // Scoring
      if (!p.passed && p.x + pipeW < bird.x - bird.r) {
        p.passed = true;
        score++;
      }

      // Off-screen cleanup
      if (p.x + pipeW < -10) {
        pipes.splice(i, 1);
      }
    }

    // Collision with pipes
    const bx = bird.x - bird.r, by = bird.y - bird.r, bw = bird.r * 2, bh = bird.r * 2;
    for (const p of pipes) {
      const upperH = p.yCenter - gap / 2;
      const lowerY = p.yCenter + gap / 2;
      // upper rect
      if (rectsOverlap(bx, by, bw, bh, p.x, 0, pipeW, upperH)) { gameOver(); break; }
      // lower rect
      if (rectsOverlap(bx, by, bw, bh, p.x, lowerY, pipeW, HEIGHT - groundH - lowerY)) { gameOver(); break; }
    }
  }

  function drawBackground() {
    // sky already via CSS; add gentle clouds
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#fff";
    for (let i=0;i<5;i++){
      const cx = (i*120 + Date.now()*0.01) % (WIDTH+200) - 100;
      const cy = 60 + (i%2)*30;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 40, 20, 0, 0, Math.PI*2);
      ctx.ellipse(cx+20, cy+10, 35, 18, 0, 0, Math.PI*2);
      ctx.ellipse(cx-20, cy+5, 30, 15, 0, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGround() {
    // scrolling ground
    const t = (Date.now()/8) % 64;
    ctx.fillStyle = "#d0903a";
    ctx.fillRect(0, HEIGHT - groundH, WIDTH, groundH);
    ctx.fillStyle = "#c27c2e";
    for (let x = -t; x < WIDTH; x += 64) {
      ctx.fillRect(x, HEIGHT - groundH, 32, 12);
    }
    // grass
    ctx.fillStyle = "#79c850";
    ctx.fillRect(0, HEIGHT - groundH, WIDTH, 12);
  }

  function drawPipes() {
    ctx.fillStyle = "#2e9d39";
    for (const p of pipes) {
      const upperH = p.yCenter - gap / 2;
      const lowerY = p.yCenter + gap / 2;
      // upper
      ctx.fillRect(p.x, 0, pipeW, upperH);
      // lower
      ctx.fillRect(p.x, lowerY, pipeW, HEIGHT - groundH - lowerY);
      // lips
      ctx.fillStyle = "#2a8c34";
      ctx.fillRect(p.x - 2, upperH - 14, pipeW + 4, 14);
      ctx.fillRect(p.x - 2, lowerY, pipeW + 4, 14);
      ctx.fillStyle = "#2e9d39";
    }
  }

  function drawBird() {
    // simple circle bird
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(Math.max(-0.4, Math.min(0.6, bird.vy/10)));
    ctx.fillStyle = "#ffd54a";
    ctx.beginPath();
    ctx.arc(0, 0, bird.r, 0, Math.PI*2);
    ctx.fill();

    // eye
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(6, -4, 4, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(7, -4, 2, 0, Math.PI*2);
    ctx.fill();

    // beak
    ctx.fillStyle = "#ff8a00";
    ctx.beginPath();
    ctx.moveTo(bird.r-2, 0);
    ctx.lineTo(bird.r+6, 3);
    ctx.lineTo(bird.r-2, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawUI() {
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.font = "24px system-ui, Segoe UI, Roboto, Arial";
    ctx.textAlign = "left";
    ctx.fillText(`Skor: ${score}`, 12, 32);
    ctx.textAlign = "right";
    ctx.fillText(`En iyi: ${best}`, WIDTH - 12, 32);

    if (state === "menu") {
      drawCenterText("FLAPPY", HEIGHT*0.34, 46, "#1b2a4a");
      drawCenterText("Başlamak için SPACE / Tıkla / Dokun", HEIGHT*0.48, 18, "#10233a");
    } else if (state === "over") {
      drawCenterText("OYUN BİTTİ", HEIGHT*0.4, 40, "#3b1020");
      drawCenterText(`Skor: ${score}  |  En iyi: ${best}`, HEIGHT*0.48, 22, "#3b1020");
      drawCenterText("Yeniden başlat: SPACE veya Buton", HEIGHT*0.56, 18, "#3b1020");
    } else if (state === "paused") {
      drawCenterText("DURAKLATILDI (P)", HEIGHT*0.45, 32, "#10233a");
    }
  }

  function drawCenterText(text, y, size, color) {
    ctx.save();
    ctx.font = `${size}px system-ui, Segoe UI, Roboto, Arial`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeText(text, WIDTH/2, y);
    ctx.fillText(text, WIDTH/2, y);
    ctx.restore();
  }

  function loop(ts) {
    if (!last) last = ts;
    const dt = ts - last; // ms
    last = ts;

    if (state !== "paused") {
      update(dt);
    }

    // Render
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawBackground();
    drawPipes();
    drawGround();
    drawBird();
    drawUI();

    requestAnimationFrame(loop);
  }

  // Start
  reset();
  requestAnimationFrame(loop);
})();