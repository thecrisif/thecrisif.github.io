const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');

let W  = canvas.width  = window.innerWidth;
let H  = canvas.height = window.innerHeight;
let cx = W / 2;
let cy = H / 2;
let t  = 0;

window.addEventListener('resize', () => {
  W  = canvas.width  = window.innerWidth;
  H  = canvas.height = window.innerHeight;
  cx = W / 2;
  cy = H / 2;
  initStars();
});

const STAR_COUNT = 220;
let stars = [];

function initStars() {
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x:             Math.random() * W,
      y:             Math.random() * H,
      r:             Math.random() * 1.8 + 0.3,
      speed:         Math.random() * 0.008 + 0.003,
      twinkleOffset: Math.random() * Math.PI * 2
    });
  }
}
initStars();

function drawStars() {
  stars.forEach(s => {
    const a = 0.4 + 0.6 * Math.abs(Math.sin(t * s.speed * 60 + s.twinkleOffset));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 220, 230, ${a})`;
    ctx.fill();
  });
}

const PLANET_R = Math.min(window.innerWidth, window.innerHeight) * 0.18;

function drawPlanet() {
  const glow = ctx.createRadialGradient(cx, cy, PLANET_R * 0.5, cx, cy, PLANET_R * 1.6);
  glow.addColorStop(0, 'rgba(255, 50, 100, 0.25)');
  glow.addColorStop(1, 'rgba(255, 50, 100, 0)');
  ctx.beginPath();
  ctx.arc(cx, cy, PLANET_R * 1.6, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  const grad = ctx.createRadialGradient(
    cx - PLANET_R * 0.3, cy - PLANET_R * 0.3, PLANET_R * 0.05,
    cx, cy, PLANET_R
  );
  grad.addColorStop(0,   '#ff8fab');
  grad.addColorStop(0.3, '#ff4d6d');
  grad.addColorStop(0.6, '#c9184a');
  grad.addColorStop(1,   '#590d22');
  ctx.beginPath();
  ctx.arc(cx, cy, PLANET_R, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  const shine = ctx.createRadialGradient(
    cx - PLANET_R * 0.35, cy - PLANET_R * 0.35, 0,
    cx - PLANET_R * 0.2,  cy - PLANET_R * 0.2,  PLANET_R * 0.7
  );
  shine.addColorStop(0, 'rgba(255, 220, 230, 0.45)');
  shine.addColorStop(1, 'rgba(255, 100, 130, 0)');
  ctx.beginPath();
  ctx.arc(cx, cy, PLANET_R, 0, Math.PI * 2);
  ctx.fillStyle = shine;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, PLANET_R, 0, Math.PI * 2);
  ctx.clip();
  for (let i = -3; i <= 3; i++) {
    const yy = cy + i * PLANET_R * 0.28;
    ctx.beginPath();
    ctx.ellipse(cx, yy, PLANET_R * 0.95, PLANET_R * 0.08, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 150, 180, 0.18)';
    ctx.lineWidth   = 2;
    ctx.stroke();
  }
  ctx.restore();
}

const RING_WORDS = [
  'Te Amo', 'Mi Reina', 'Mi Vida', 'Mi Luz',
  'Mi Todo', 'Mi Cielo', 'Mi Amor', 'Mi Tesoro', 'Mi Corazón'
];
const RING_TEXT = RING_WORDS.join('  ✦  ') + '  ✦  ';
const RING_RX   = PLANET_R * 2.1;
const RING_RY   = PLANET_R * 0.52;

function drawRing(front) {
  ctx.save();
  ctx.translate(cx, cy);

  const totalChars = RING_TEXT.length;
  const angleStep  = (Math.PI * 2) / totalChars;

  ctx.font         = `bold ${Math.max(10, PLANET_R * 0.115)}px Georgia`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < totalChars; i++) {
    const angle   = i * angleStep + t * 0.35;
    const isFront = Math.sin(angle) > 0;
    if (isFront !== front) continue;

    const x     = Math.cos(angle) * RING_RX;
    const y     = Math.sin(angle) * RING_RY;
    const depth = (Math.sin(angle) + 1) / 2;
    const alpha = front ? 0.5 + depth * 0.5 : 0.15 + depth * 0.25;
    const scale = front ? 0.75 + depth * 0.35 : 0.5 + depth * 0.2;
    const hue   = 340 + Math.sin(angle + t) * 20;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.scale(scale, scale);
    ctx.fillStyle   = `hsla(${hue}, 100%, 70%, ${alpha})`;
    ctx.shadowColor = `hsla(${hue}, 100%, 60%, ${alpha * 0.8})`;
    ctx.shadowBlur  = 8;
    ctx.fillText(RING_TEXT[i], 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

let hearts = [];
for (let i = 0; i < 18; i++) {
  hearts.push({
    x:     Math.random() * W,
    y:     Math.random() * H,
    size:  Math.random() * 14 + 6,
    speed: Math.random() * 0.4 + 0.2,
    alpha: Math.random() * 0.5 + 0.2,
    drift: (Math.random() - 0.5) * 0.5
  });
}

function drawHearts() {
  hearts.forEach(h => {
    h.y -= h.speed;
    h.x += h.drift;
    if (h.y < -20) {
      h.y = H + 20;
      h.x = Math.random() * W;
    }
    ctx.save();
    ctx.globalAlpha = h.alpha * (0.5 + 0.5 * Math.abs(Math.sin(t * 0.5)));
    ctx.fillStyle   = `hsl(${340 + Math.random() * 30}, 100%, 70%)`;
    ctx.font        = `${h.size}px serif`;
    ctx.fillText('♥', h.x, h.y);
    ctx.restore();
  });
}

function loop() {
  ctx.clearRect(0, 0, W, H);

  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H));
  bg.addColorStop(0,   '#1a0010');
  bg.addColorStop(0.5, '#0d0008');
  bg.addColorStop(1,   '#050003');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  drawStars();
  drawHearts();
  drawRing(false);
  drawPlanet();
  drawRing(true);

  t += 0.012;
  requestAnimationFrame(loop);
}

loop();
