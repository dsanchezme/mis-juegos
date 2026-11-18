/** One scoring group in a roll, e.g. three 4s or a single 5. */
export interface ScoringPart {
  kind: "single" | "three" | "four";
  face: number;
  count: number;
  points: number;
}

export interface Score {
  points: number;
  /** For each rolled die, whether it scores. */
  scoring: boolean[];
  /** Scoring groups, used by the UI to explain the score. */
  parts: ScoringPart[];
}

/**
 * Score of a single roll.
 * - 1 = 100, 5 = 50
 * - Three of a kind = face × 100 (three 1s = 1,000)
 * - Four of a kind = face × 1,000 (four 1s = 10,000)
 * Three and four of a kind only count within the same roll.
 * Every scoring die counts; the player cannot choose to keep fewer.
 */
export function score(faces: number[]): Score {
  const scoring = faces.map(() => false);
  const parts: ScoringPart[] = [];
  let points = 0;

  for (let n = 1; n <= 6; n++) {
    const indices = faces.map((c, i) => (c === n ? i : -1)).filter((i) => i >= 0);
    let singles = indices;
    if (indices.length >= 3) {
      const groupSize = indices.length >= 4 ? 4 : 3;
      const value = groupSize === 4 ? (n === 1 ? 10000 : n * 1000) : n === 1 ? 1000 : n * 100;
      points += value;
      for (const i of indices.slice(0, groupSize)) scoring[i] = true;
      parts.push({ kind: groupSize === 4 ? "four" : "three", face: n, count: groupSize, points: value });
      singles = indices.slice(groupSize);
    }
    if ((n === 1 || n === 5) && singles.length) {
      const unit = n === 1 ? 100 : 50;
      for (const i of singles) scoring[i] = true;
      points += unit * singles.length;
      parts.push({ kind: "single", face: n, count: singles.length, points: unit * singles.length });
    }
  }
  return { points, scoring, parts };
}
