/** A person from the hub's player list. */
export interface Person {
  id: string;
  name: string;
  color: string;
}

/** Contract every game in the hub implements. Rules are pure functions so they can be tested and, later, run on a server. */
export interface GameDefinition<Config, State, Action> {
  id: string;
  name: string;
  description: string;
  players: { min: number; max?: number };
  newState(people: Person[], config: Config, seed: number): State;
  apply(state: State, action: Action): State;
}

/** A finished game, stored in the shared history. */
export interface FinishedGame {
  id: string;
  game: string;
  date: string; // ISO date
  players: { id: string; name: string; color: string; points: number }[];
  winners: string[]; // player ids; empty if the game ended with no winner
  /** Game-specific facts (target, rounds…), described by the game's catalog entry. */
  info: Record<string, string | number | boolean>;
}
