/**
 * Golden star-burst particle animation on a token using native PIXI.
 * No external module dependencies — Foundry ships PIXI built-in.
 */

/** Number of particles in the burst */
const PARTICLE_COUNT = 28;

/** Duration of the full animation in ms */
const DURATION = 2200;

/** Max outward travel distance in pixels */
const MAX_RADIUS = 160;

/** Star shapes drawn procedurally */
const STAR_POINTS = 5;
const STAR_OUTER = 8;
const STAR_INNER = 3.5;

/**
 * Build a small star-shaped PIXI.Graphics texture.
 * @param {number} outer - Outer radius
 * @param {number} inner - Inner radius
 * @param {number} color - Fill color
 * @param {number} alpha - Fill alpha
 * @returns {PIXI.Graphics}
 */
function drawStar(outer, inner, color, alpha) {
  const g = new PIXI.Graphics();
  g.beginFill(color, alpha);
  const step = Math.PI / STAR_POINTS;
  for (let i = 0; i < STAR_POINTS * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = i * step - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.endFill();
  return g;
}

/**
 * Find the first token for an actor on the current scene.
 * @param {string} actorId
 * @returns {Token|null}
 */
function findToken(actorId) {
  if (!canvas.scene) return null;
  const tokenDoc = canvas.scene.tokens.find((t) => t.actorId === actorId);
  return tokenDoc?.object ?? null;
}

/**
 * Play a golden star-burst particle animation centered on the actor's token.
 * Particles radiate outward, spin, scale down, and fade out.
 * Falls back gracefully (no-op) if the token is not on the current scene.
 *
 * @param {string} actorId - The actor whose token to animate
 * @returns {Promise<void>} Resolves when the animation completes
 */
export function playTokenBurst(actorId) {
  return new Promise((resolve) => {
    const token = findToken(actorId);
    if (!token) {
      resolve();
      return;
    }

    // Center of the token in canvas coordinates
    const cx = token.center.x;
    const cy = token.center.y;

    // Create a container on the canvas effects layer
    const container = new PIXI.Container();
    container.position.set(cx, cy);
    container.zIndex = 9999;
    canvas.interface.addChild(container);

    // Add a central glow circle
    const glow = new PIXI.Graphics();
    glow.beginFill(0xdaa520, 0.25);
    glow.drawCircle(0, 0, token.w * 0.6);
    glow.endFill();
    glow.alpha = 0;
    container.addChild(glow);

    // Spawn particles
    const particles = [];
    const colors = [0xdaa520, 0xb8860b, 0xffd700, 0xffa500, 0xffffff];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.4;
      const speed = 0.5 + Math.random() * 0.5; // distance multiplier
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = STAR_OUTER * (0.6 + Math.random() * 0.8);
      const innerSize = STAR_INNER * (0.6 + Math.random() * 0.8);

      const star = drawStar(size, innerSize, color, 0.9);
      star.position.set(0, 0);
      star.rotation = Math.random() * Math.PI * 2;
      container.addChild(star);

      particles.push({
        gfx: star,
        angle,
        speed,
        spinRate: (Math.random() - 0.5) * 6, // radians per second
        delay: Math.random() * 0.15, // stagger start (0–15% of duration)
      });
    }

    const startTime = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / DURATION, 1);

      // Central glow: fade in then out
      if (t < 0.3) {
        glow.alpha = (t / 0.3) * 0.35;
      } else {
        glow.alpha = 0.35 * (1 - (t - 0.3) / 0.7);
      }
      const glowScale = 1 + t * 0.5;
      glow.scale.set(glowScale, glowScale);

      for (const p of particles) {
        // Per-particle progress with staggered start
        const pt = Math.max(0, Math.min((t - p.delay) / (1 - p.delay), 1));

        // Ease-out for outward movement
        const eased = 1 - Math.pow(1 - pt, 3);
        const dist = eased * MAX_RADIUS * p.speed;

        p.gfx.position.set(
          Math.cos(p.angle) * dist,
          Math.sin(p.angle) * dist,
        );

        // Spin
        p.gfx.rotation += p.spinRate * (1 / 60);

        // Scale: grow in, then shrink out
        let scale;
        if (pt < 0.2) {
          scale = pt / 0.2;
        } else {
          scale = 1 - ((pt - 0.2) / 0.8) * 0.8;
        }
        p.gfx.scale.set(scale, scale);

        // Fade out in the last 40%
        p.gfx.alpha = pt > 0.6 ? 1 - (pt - 0.6) / 0.4 : 1;
      }

      if (t >= 1) {
        // Clean up
        canvas.interface.removeChild(container);
        container.destroy({ children: true });
        resolve();
        return;
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}
