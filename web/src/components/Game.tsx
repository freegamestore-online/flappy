import { useRef, useEffect, useCallback } from "react";

interface GameProps {
  onScore: (score: number) => void;
  onGameOver: () => void;
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

export function Game({ onScore, onGameOver }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State | null>(null);
  const onScoreRef = useRef(onScore);
  const onGameOverRef = useRef(onGameOver);
  onScoreRef.current = onScore;
  onGameOverRef.current = onGameOver;
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);

  const flap = useCallback(() => {
    const s = stateRef.current;
    if (!s || !s.alive) return;
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
        if (s.bird.y + BIRD_RADIUS > groundY || s.bird.y - BIRD_RADIUS < 0) {
          s.alive = false;
          onGameOverRef.current();
        }

        // Collision: pipes
        for (const pipe of s.pipes) {
          const pipeLeft = pipe.x;
          const pipeRight = pipe.x + PIPE_WIDTH;
          // Bird hitbox as circle
          if (birdPx + BIRD_RADIUS > pipeLeft && birdPx - BIRD_RADIUS < pipeRight) {
            const halfGap = pipe.gapSize / 2;
            if (
              s.bird.y - BIRD_RADIUS < pipe.gapY - halfGap ||
              s.bird.y + BIRD_RADIUS > pipe.gapY + halfGap
            ) {
              s.alive = false;
              onGameOverRef.current();
            }
          }
        }
      }

      // --- Draw ---
      // Sky gradient
      const skyGrad = ctx!.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, "#87CEEB");
      skyGrad.addColorStop(0.7, "#E0F0FF");
      skyGrad.addColorStop(1, "#B8E08C");
      ctx!.fillStyle = skyGrad;
      ctx!.fillRect(0, 0, w, h);

      // Ground
      ctx!.fillStyle = "#5B8C2A";
      ctx!.fillRect(0, groundY, w, GROUND_HEIGHT);
      ctx!.fillStyle = "#4A7A22";
      ctx!.fillRect(0, groundY, w, 4);

      // Pipes
      for (const pipe of s.pipes) {
        const halfGap = pipe.gapSize / 2;

        // Top pipe
        ctx!.fillStyle = "#2D8B2D";
        ctx!.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.gapY - halfGap);
        // Top pipe cap
        ctx!.fillStyle = "#35A035";
        ctx!.fillRect(pipe.x - 3, pipe.gapY - halfGap - 20, PIPE_WIDTH + 6, 20);

        // Bottom pipe
        ctx!.fillStyle = "#2D8B2D";
        ctx!.fillRect(pipe.x, pipe.gapY + halfGap, PIPE_WIDTH, groundY - (pipe.gapY + halfGap));
        // Bottom pipe cap
        ctx!.fillStyle = "#35A035";
        ctx!.fillRect(pipe.x - 3, pipe.gapY + halfGap, PIPE_WIDTH + 6, 20);

        // Pipe highlight (light stripe)
        ctx!.fillStyle = "rgba(255,255,255,0.15)";
        ctx!.fillRect(pipe.x + 4, 0, 8, pipe.gapY - halfGap);
        ctx!.fillRect(pipe.x + 4, pipe.gapY + halfGap, 8, groundY - (pipe.gapY + halfGap));
      }

      // Bird
      const bx = w * BIRD_X;
      const by = s.bird.y;
      // Rotation based on velocity
      const angle = Math.max(-0.5, Math.min(Math.PI / 4, s.bird.velocity * 3));

      ctx!.save();
      ctx!.translate(bx, by);
      ctx!.rotate(angle);

      // Body (oval)
      ctx!.fillStyle = "#FFD700";
      ctx!.beginPath();
      ctx!.ellipse(0, 0, BIRD_RADIUS, BIRD_RADIUS * 0.8, 0, 0, Math.PI * 2);
      ctx!.fill();

      // Belly highlight
      ctx!.fillStyle = "#FFF3B0";
      ctx!.beginPath();
      ctx!.ellipse(2, 3, BIRD_RADIUS * 0.55, BIRD_RADIUS * 0.45, 0, 0, Math.PI * 2);
      ctx!.fill();

      // Wing
      ctx!.fillStyle = "#E6A800";
      ctx!.beginPath();
      const wingFlap = s.alive ? Math.sin(s.time * 0.012) * 4 : 0;
      ctx!.ellipse(-4, -2 + wingFlap, 8, 5, -0.3, 0, Math.PI * 2);
      ctx!.fill();

      // Eye (white)
      ctx!.fillStyle = "#FFFFFF";
      ctx!.beginPath();
      ctx!.arc(8, -5, 5, 0, Math.PI * 2);
      ctx!.fill();
      // Pupil
      ctx!.fillStyle = "#000000";
      ctx!.beginPath();
      ctx!.arc(9.5, -5, 2.5, 0, Math.PI * 2);
      ctx!.fill();

      // Beak
      ctx!.fillStyle = "#FF6B35";
      ctx!.beginPath();
      ctx!.moveTo(BIRD_RADIUS - 2, -2);
      ctx!.lineTo(BIRD_RADIUS + 8, 1);
      ctx!.lineTo(BIRD_RADIUS - 2, 4);
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
