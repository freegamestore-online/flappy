import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { Game, rescaleState, type State } from "../components/Game";

describe("rescaleState", () => {
  it("keeps bird and pipes in place relative to the playfield", () => {
    const s: State = {
      bird: { y: 100, velocity: 0 },
      pipes: [{ x: 200, gapY: 150, gapSize: 160, scored: false }],
      score: 0,
      alive: true,
      nextPipeX: 1.2,
      pipeCount: 1,
      time: 0,
    };
    rescaleState(s, 400, 300, 800, 600);
    expect(s.bird.y).toBe(200);
    expect(s.pipes[0]).toMatchObject({ x: 400, gapY: 300, gapSize: 160 });
  });

  it("ignores a zero-sized previous canvas", () => {
    const s = { bird: { y: 100, velocity: 0 }, pipes: [] } as unknown as State;
    rescaleState(s, 0, 0, 800, 600);
    expect(s.bird.y).toBe(100);
  });
});

describe("canvas sizing", () => {
  const setTransform = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("devicePixelRatio", 2);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      new Proxy({ setTransform }, {
        get: (t, k) => (k in t ? t[k as keyof typeof t] : () => ({ addColorStop() {} })),
      }) as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(500);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("scales the backing store by devicePixelRatio", () => {
    const { container } = render(
      <div>
        <Game onScore={() => {}} onGameOver={() => {}} />
      </div>,
    );
    const canvas = container.querySelector("canvas")!;
    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(1000);
    expect(setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
  });
});
