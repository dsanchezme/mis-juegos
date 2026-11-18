const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

interface Props {
  face: number;
  size?: number;
  state?: "normal" | "scoring" | "kept" | "dead" | "rolling";
  delay?: number;
}

export function Die({ face, size = 52, state = "normal", delay = 0 }: Props) {
  return (
    <div
      className={`die ${state} ${face === 1 ? "one" : ""}`}
      style={{ ["--s" as string]: `${size}px`, animationDelay: `${delay}ms` }}
      role="img"
      aria-label={`die ${face}`}
    >
      {PIPS[face]?.map((i) => (
        <i key={i} style={{ gridArea: `${Math.floor(i / 3) + 1} / ${(i % 3) + 1}` }} />
      ))}
    </div>
  );
}
