import { act, render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const submitScore = vi.fn();
let gameOver: (() => void) | undefined;

vi.mock("../components/Game", () => ({
  Game: (props: { onGameOver: () => void }) => {
    gameOver = props.onGameOver;
    return null;
  },
}));

vi.mock("@freegamestore/games", async (orig) => ({
  ...(await orig<typeof import("@freegamestore/games")>()),
  useLeaderboard: () => ({ submitScore, topScores: [], recentScores: [], loading: false, refresh: () => {} }),
}));

import App from "../App";

describe("leaderboard submission", () => {
  it("does not submit a score of 0", () => {
    render(<App />);
    act(() => gameOver?.());
    expect(submitScore).not.toHaveBeenCalled();
  });
});
