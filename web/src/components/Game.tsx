import { useRef, useEffect, useCallback } from "react";

interface GameProps {
  onScore: (score: number) => void;
  onGameOver: () => void;
  paused?: boolean;
}

// Physics
const GRAVITY = 0.0006;
const FLAP_VELOCITY = -0.32;
const BIRD_X = 0.2; // fraction of canvas width
const BIRD_RADIUS = 15;

// Pipes
const PIPE_WIDTH = 52;
const PIPE_GAP_INITIAL = 160;
const PIPE_GAP_MIN = 110;
const PIPE_GAP_SHRINK = 0.5; // per pipe scored
const PIPE_SPEED = 2.5; // pixels per frame at 60fps, scaled by dt
const PIPE_SPACING = 220;

// Ground
const GROUND_HEIGHT = 60;

interface Bird {
  y: number;
  velocity: number;
}

interface Pipe {
  x: number;
  gapY: number;
  gapSize: number;
  scored: boolean;
}

interface State {
  bird: Bird;
  pipes: Pipe[];
  score: number;
  alive: boolean;
  nextPipeX: number;
  pipeCount: number;
  time: number;
}

function createState(canvasH: number): State {
  return {
    bird: { y: canvasH * 0.4, velocity: 0 },
    pipes: [],
    score: 0,
    alive: true,
    nextPipeX: 1.2, // fraction of canvas width
    pipeCount: 0,
    time: 0,
  };
}

export function Game({ onScore, onGameOver, paused }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State | null>(null);
  const onScoreRef = useRef(onScore);
  const onGameOverRef = useRef(onGameOver);
  const pausedRef = useRef(paused);
  onScoreRef.current = onScore;
  onGameOverRef.current = onGameOver;
  pausedRef.current = paused;
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);

  const flap = useCallback(() => {
    const s = stateRef.current;
    if (!s || !s.alive || pausedRef.current) return;
    s.bird.velocity = FLAP_VELOCITY;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      canvas!.width = parent.clientWidth;
      canvas!.height = parent.clientHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    stateRef.current = createState(canvas.height);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowUp") {
        e.preventDefault();
        flap();
      }
    };
    const handleMouse = (e: MouseEvent) => {
      e.preventDefault();
      flap();
    };
    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      flap();
    };

    window.addEventListener("keydown", handleKey);
    canvas.addEventListener("mousedown", handleMouse);
    canvas.addEventListener("touchstart", handleTouch, { passive: false });

    lastTimeRef.current = performance.now();

    function loop(now: number) {
      rafRef.current = requestAnimationFrame(loop);
      if (pausedRef.current) {
        lastTimeRef.current = now;
        return;
      }
      const dt = Math.min(now - lastTimeRef.current, 33.33); // cap at ~30fps worth of delta
      lastTimeRef.current = now;

      const s = stateRef.current!;
      const w = canvas!.width;
      const h = canvas!.height;
      const groundY = h - GROUND_HEIGHT;

      if (s.alive) {
        // dt is in ms, scale everything to ms
        const dtScale = dt / 16.667; // normalise to 60fps

        // Bird physics
        s.bird.velocity += GRAVITY * dt;
        s.bird.y += s.bird.velocity * dt;
        s.time += dt;

        // Spawn pipes
        const birdPx = w * BIRD_X;
        while (s.nextPipeX * w < w + PIPE_SPACING) {
          const gapSize = Math.max(
            PIPE_GAP_MIN,
            PIPE_GAP_INITIAL - s.pipeCount * PIPE_GAP_SHRINK,
          );
          const minGapY = gapSize / 2 + 40;
          const maxGapY = groundY - gapSize / 2 - 40;
          const gapY = minGapY + Math.random() * (maxGapY - minGapY);
          s.pipes.push({
            x: s.nextPipeX * w,
            gapY,
            gapSize,
            scored: false,
          });
          s.pipeCount++;
          s.nextPipeX += PIPE_SPACING / w;
        }

        // Move pipes
        const speed = PIPE_SPEED * dtScale;
        for (const pipe of s.pipes) {
          pipe.x -= speed;
        }
        s.nextPipeX -= speed / w;

        // Remove off-screen pipes
        s.pipes = s.pipes.filter((p) => p.x + PIPE_WIDTH > -10);

        // Score
        for (const pipe of s.pipes) {
          if (!pipe.scored && pipe.x + PIPE_WIDTH < birdPx) {
            pipe.scored = true;
            s.score++;
            onScoreRef.current(s.score);
          }
        }

        // Collision: ground or ceiling
        let hit = s.bird.y + BIRD_RADIUS > groundY || s.bird.y - BIRD_RADIUS < 0;

        // Collision: pipes
        for (const pipe of s.pipes) {
          if (hit) break;
          const pipeLeft = pipe.x;
          const pipeRight = pipe.x + PIPE_WIDTH;
          // Bird hitbox as circle
          if (birdPx + BIRD_RADIUS > pipeLeft && birdPx - BIRD_RADIUS < pipeRight) {
            const halfGap = pipe.gapSize / 2;
            if (
              s.bird.y - BIRD_RADIUS < pipe.gapY - halfGap ||
              s.bird.y + BIRD_RADIUS > pipe.gapY + halfGap
            ) {
              hit = true;
            }
          }
        }

        if (hit) {
          s.alive = false;
          onGameOverRef.current();
        }
      }

      // --- Draw ---
      // Sky gradient (brand paper tones with a soft accent tint)
      const skyGrad = ctx!.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, "#dbeafe");
      skyGrad.addColorStop(0.75, "#f9fafb");
      skyGrad.addColorStop(1, "#ffffff");
      ctx!.fillStyle = skyGrad;
      ctx!.fillRect(0, 0, w, h);

      // Ground: ink slab with an accent edge
      ctx!.fillStyle = "#1f2937";
      ctx!.fillRect(0, groundY, w, GROUND_HEIGHT);
      ctx!.fillStyle = "#2563eb";
      ctx!.fillRect(0, groundY, w, 4);

      // Obstacles: flat accent-blue pillars with a darker lip and a square end cap
      for (const pipe of s.pipes) {
        const halfGap = pipe.gapSize / 2;
        const topEnd = pipe.gapY - halfGap;
        const bottomStart = pipe.gapY + halfGap;

        // Top obstacle body and lip
        ctx!.fillStyle = "#2563eb";
        ctx!.fillRect(pipe.x, 0, PIPE_WIDTH, topEnd);
        ctx!.fillStyle = "#1e40af";
        ctx!.fillRect(pipe.x - 3, topEnd - 20, PIPE_WIDTH + 6, 20);

        // Bottom obstacle body and lip
        ctx!.fillStyle = "#2563eb";
        ctx!.fillRect(pipe.x, bottomStart, PIPE_WIDTH, groundY - bottomStart);
        ctx!.fillStyle = "#1e40af";
        ctx!.fillRect(pipe.x - 3, bottomStart, PIPE_WIDTH + 6, 20);

        // Inner highlight stripe
        ctx!.fillStyle = "rgba(255,255,255,0.18)";
        ctx!.fillRect(pipe.x + 6, 0, 6, topEnd - 20);
        ctx!.fillRect(pipe.x + 6, bottomStart + 20, 6, groundY - bottomStart - 20);
      }

      // Bird
      const bx = w * BIRD_X;
      const by = s.bird.y;
      // Rotation based on velocity
      const angle = Math.max(-0.5, Math.min(Math.PI / 4, s.bird.velocity * 3));

      ctx!.save();
      ctx!.translate(bx, by);
      ctx!.rotate(angle);

      // Tail fin (swept back, behind the body)
      ctx!.fillStyle = "#b45309";
      ctx!.beginPath();
      ctx!.moveTo(-BIRD_RADIUS + 3, -1);
      ctx!.lineTo(-BIRD_RADIUS - 7, -9);
      ctx!.lineTo(-BIRD_RADIUS - 3, 1);
      ctx!.closePath();
      ctx!.fill();

      // Body (streamlined nose-forward oval)
      ctx!.fillStyle = "#d97706";
      ctx!.beginPath();
      ctx!.ellipse(0, 0, BIRD_RADIUS, BIRD_RADIUS * 0.6, 0, 0, Math.PI * 2);
      ctx!.fill();

      // Swept wing, flaps by a few pixels while alive
      ctx!.fillStyle = "#b45309";
      ctx!.beginPath();
      const wingFlap = s.alive ? Math.sin(s.time * 0.012) * 3 : 0;
      ctx!.moveTo(4, 0);
      ctx!.lineTo(-8, 8 + wingFlap);
      ctx!.lineTo(-4, 0);
      ctx!.closePath();
      ctx!.fill();

      // Cockpit canopy
      ctx!.fillStyle = "#ffffff";
      ctx!.beginPath();
      ctx!.ellipse(5, -2, 4.5, 2.6, 0, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = "#1a1a1a";
      ctx!.beginPath();
      ctx!.arc(6.5, -2, 1.6, 0, Math.PI * 2);
      ctx!.fill();

      // Nose stripe in brand accent
      ctx!.fillStyle = "#2563eb";
      ctx!.beginPath();
      ctx!.moveTo(BIRD_RADIUS - 1, -3);
      ctx!.lineTo(BIRD_RADIUS + 4, 0);
      ctx!.lineTo(BIRD_RADIUS - 1, 3);
      ctx!.closePath();
      ctx!.fill();

      ctx!.restore();
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown", handleMouse);
      canvas.removeEventListener("touchstart", handleTouch);
    };
  }, [flap]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", cursor: "pointer" }}
    />
  );
}
