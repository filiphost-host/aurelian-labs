import { createHash, randomBytes } from "node:crypto";

const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createShareToken() {
  return randomBytes(32).toString("base64url");
}

export function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidShareToken(token: string) {
  return SHARE_TOKEN_PATTERN.test(token);
}
