import { describe, expect, it } from "vitest";
import {
  createShareToken,
  hashShareToken,
  isValidShareToken,
} from "@/lib/share-tokens";

describe("share snapshot tokens", () => {
  it("creates opaque 256-bit URL-safe tokens", () => {
    const tokens = Array.from({ length: 100 }, createShareToken);
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(tokens.every(isValidShareToken)).toBe(true);
  });

  it("stores a one-way hash rather than the public token", () => {
    const token = createShareToken();
    const hash = hashShareToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashShareToken(`${token}x`)).not.toBe(hash);
  });

  it("rejects malformed or guessable path values", () => {
    expect(isValidShareToken("share-123")).toBe(false);
    expect(isValidShareToken("../private")).toBe(false);
    expect(isValidShareToken("a".repeat(43))).toBe(true);
  });
});
