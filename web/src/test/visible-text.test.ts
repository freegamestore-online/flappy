import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const WEB = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(WEB, rel), "utf-8");

// Every place a player or the browser can see the game's name.
const visibleSources = {
  "index.html (<title>)": read("index.html"),
  "vite.config.ts (PWA manifest)": read("vite.config.ts"),
  "src/App.tsx (topbar, rules, game over)": read("src/App.tsx"),
};

// Old Flappy Bird colours from the bird sprite, pipes and sky/ground.
const TRADE_DRESS_COLOURS = ["#87CEEB", "#B8E08C", "#5B8C2A", "#FFD700", "#FF6B35", "#2D8B2D", "#35A035"];

describe("visible text", () => {
  for (const [name, source] of Object.entries(visibleSources)) {
    it(`${name} does not say "Flappy Bird"`, () => {
      expect(source).not.toMatch(/flappy\s*bird/i);
    });

    it(`${name} does not show the bare "Flappy" name`, () => {
      expect(source).not.toMatch(/Flappy/);
    });
  }

  it('shows "Pipe Flyer" in the page title', () => {
    expect(visibleSources["index.html (<title>)"]).toMatch(/<title>Pipe Flyer\b/);
  });

  it('uses "Pipe Flyer" for the PWA name and short name', () => {
    const config = visibleSources["vite.config.ts (PWA manifest)"];
    expect(config).toContain("name: 'Pipe Flyer'");
    expect(config).toContain("short_name: 'Pipe Flyer'");
  });

  it('shows "Pipe Flyer" in the topbar and rules', () => {
    const app = visibleSources["src/App.tsx (topbar, rules, game over)"];
    expect(app).toContain('title="Pipe Flyer"');
    expect(app).toContain(">Pipe Flyer</h3>");
  });
});

describe("trade dress", () => {
  const game = read("src/components/Game.tsx");

  for (const colour of TRADE_DRESS_COLOURS) {
    it(`Game.tsx does not use the old colour ${colour}`, () => {
      expect(game.toUpperCase()).not.toContain(colour.toUpperCase());
    });
  }

  it("Game.tsx does not play the SDK sound effects", () => {
    expect(game).not.toContain("useGameSounds");
    expect(game).not.toMatch(/\.play(Move|Score|GameOver)\(/);
  });
});

describe("identifiers kept for continuity", () => {
  it("keeps the leaderboard id and best-score storage key", () => {
    const app = read("src/App.tsx");
    expect(app).toContain('useLeaderboard("flappy")');
    expect(app).toContain('"freeflappy-best"');
  });
});
