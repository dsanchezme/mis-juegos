import { describe, expect, it } from "vitest";
import { cleanCode, codeFromHash, formatCode, freeColor, isCompleteCode, joinHash, joinLink } from "./lobby";

describe("room codes", () => {
  it("cleans what people type: case, spaces and look-alikes", () => {
    expect(cleanCode(" k7m q2p ")).toBe("K7MQ2P");
    expect(cleanCode("K7M-Q2P-XYZ")).toBe("K7MQ2P");
    expect(cleanCode("O0I1L")).toBe("");
  });

  it("knows when a code is complete", () => {
    expect(isCompleteCode("K7MQ2P")).toBe(true);
    expect(isCompleteCode("K7MQ2")).toBe(false);
    expect(isCompleteCode("k7mq2p")).toBe(false);
  });

  it("formats codes in two halves", () => {
    expect(formatCode("K7MQ2P")).toBe("K7M Q2P");
  });
});

describe("join links", () => {
  it("builds and reads the hash route", () => {
    expect(joinHash("ambicioso", "K7MQ2P")).toBe("#ambicioso/join/K7MQ2P");
    expect(codeFromHash("#ambicioso/join/K7MQ2P", "ambicioso")).toBe("K7MQ2P");
    expect(codeFromHash("#/ambicioso/join/k7mq2p", "ambicioso")).toBe("K7MQ2P");
  });

  it("ignores anything that is not a valid join link", () => {
    expect(codeFromHash("#ambicioso", "ambicioso")).toBeNull();
    expect(codeFromHash("#ambicioso/join/ABC", "ambicioso")).toBeNull();
    expect(codeFromHash("#other/join/K7MQ2P", "ambicioso")).toBeNull();
  });

  it("builds the full link from the page address", () => {
    expect(joinLink("ambicioso", "K7MQ2P", { origin: "https://x.github.io", pathname: "/mis-juegos/" })).toBe(
      "https://x.github.io/mis-juegos/#ambicioso/join/K7MQ2P",
    );
  });
});

describe("freeColor", () => {
  it("keeps the preferred color when nobody has it", () => {
    expect(freeColor(["#f4b942"], "#4CC9F0")).toBe("#4cc9f0");
  });

  it("otherwise picks the first free color of the palette", () => {
    expect(freeColor(["#F4B942"], "#f4b942")).toBe("#4cc9f0");
    expect(freeColor([])).toBe("#f4b942");
  });
});
