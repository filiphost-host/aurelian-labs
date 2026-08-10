export type CallBudget = { take: () => boolean; used: () => number };

export function createCallBudget(limit: number): CallBudget {
  let used = 0;
  return {
    take: () => {
      if (used >= limit) return false;
      used += 1;
      return true;
    },
    used: () => used,
  };
}

export type ParsedClose = { date: string; close: number };

export function parseEodhdClose(payload: unknown): ParsedClose | null {
  const record = Array.isArray(payload) ? payload[0] : payload;
  if (!record || typeof record !== "object") return null;
  const { date, close } = record as { date?: unknown; close?: unknown };
  const parsedClose = Number(close);
  if (typeof date !== "string" || !date || !Number.isFinite(parsedClose) || parsedClose <= 0) return null;
  return { date: date.slice(0, 10), close: parsedClose };
}

export function parseYahooCloses(payload: unknown): ParsedClose[] {
  const result = (payload as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    };
  } | null)?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  return closes.flatMap((close, index) => {
    const timestamp = timestamps[index];
    return typeof close === "number" && Number.isFinite(close) && close > 0 && typeof timestamp === "number"
      ? [{ date: new Date(timestamp * 1000).toISOString().slice(0, 10), close }]
      : [];
  });
}
