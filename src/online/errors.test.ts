import { afterEach, describe, expect, it, vi } from "vitest";
import { toOnlineError } from "./errors";

afterEach(() => vi.unstubAllGlobals());

describe("toOnlineError", () => {
  it("recognizes the codes the database and the server send", () => {
    expect(toOnlineError({ message: "color_taken" })).toBe("color_taken");
    expect(toOnlineError({ message: "room_not_found" })).toBe("room_not_found");
    expect(toOnlineError("not_your_turn")).toBe("not_your_turn");
  });

  it("treats network failures as being offline", () => {
    expect(toOnlineError(new TypeError("Failed to fetch"))).toBe("offline");
    vi.stubGlobal("navigator", { onLine: false });
    expect(toOnlineError({ message: "color_taken" })).toBe("offline");
  });

  it("anything else is unknown", () => {
    expect(toOnlineError({ message: "boom" })).toBe("unknown");
    expect(toOnlineError(null)).toBe("unknown");
  });
});
