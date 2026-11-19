import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { qrMatrix, qrPath } from "./qr";

/** Paints the matrix as RGBA pixels, `scale` pixels per module, the way a camera would see it. */
function pixels(matrix: boolean[][], scale: number) {
  const size = matrix.length * scale;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = matrix[Math.floor(y / scale)][Math.floor(x / scale)] ? 0 : 255;
      data.set([value, value, value, 255], (y * size + x) * 4);
    }
  }
  return { data, size };
}

describe("qr", () => {
  it("encodes a join link that a scanner reads back", () => {
    const link = "https://dsanchezme.github.io/mis-juegos/#ambicioso/join/K7P2QX";
    const { data, size } = pixels(qrMatrix(link), 4);
    expect(jsQR(data, size, size)?.data).toBe(link);
  });

  it("leaves a blank quiet zone around the code", () => {
    const matrix = qrMatrix("hello");
    for (const i of [0, 3]) {
      expect(matrix[i].some(Boolean)).toBe(false);
      expect(matrix.every((row) => !row[i])).toBe(true);
    }
    expect(matrix[4].some(Boolean)).toBe(true);
  });

  it("draws one square per dark module", () => {
    const matrix = [
      [true, false],
      [false, true],
    ];
    expect(qrPath(matrix)).toBe("M0 0h1v1h-1zM1 1h1v1h-1z");
  });
});
