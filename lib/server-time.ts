import "server-only";

export function isExpired(timestamp: string) {
  return new Date(timestamp).getTime() <= Date.now();
}
