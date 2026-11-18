const PUNTOS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

interface Props {
  cara: number;
  tamano?: number;
  estado?: "normal" | "suma" | "apartado" | "muerto" | "rodando";
  retraso?: number;
}

export function Dado({ cara, tamano = 52, estado = "normal", retraso = 0 }: Props) {
  return (
    <div
      className={`dado ${estado} ${cara === 1 ? "uno" : ""}`}
      style={{ ["--s" as string]: `${tamano}px`, animationDelay: `${retraso}ms` }}
      role="img"
      aria-label={`dado ${cara}`}
    >
      {PUNTOS[cara]?.map((i) => (
        <i key={i} style={{ gridArea: `${Math.floor(i / 3) + 1} / ${(i % 3) + 1}` }} />
      ))}
    </div>
  );
}
