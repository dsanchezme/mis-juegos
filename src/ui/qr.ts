import { encode } from "uqr";

/** Dark modules of a QR code as booleans, with the standard four-module quiet zone. */
export function qrMatrix(text: string): boolean[][] {
  // Medium error correction still reads well off a bright, slightly scratched phone screen.
  return encode(text, { ecc: "M", border: 4 }).data;
}

/** One SVG path that draws every dark module as a 1×1 square. */
export function qrPath(matrix: boolean[][]): string {
  const parts: string[] = [];
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) parts.push(`M${x} ${y}h1v1h-1z`);
    });
  });
  return parts.join("");
}
