export interface Pipe {
  id: number;
  x: number;
  gapY: number;
  gapSize: number;
  scored: boolean;
}

export type GamePhase = "menu" | "playing" | "over";
