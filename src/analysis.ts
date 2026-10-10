import type { Candle, Story, Tone } from "./types";
const positive = new Set([
  "adoption",
  "approve",
  "approved",
  "approval",
  "bullish",
  "breakout",
  "gain",
  "gains",
  "growth",
  "growing",
  "high",
  "inflow",
  "inflows",
  "launch",
  "launches",
  "milestone",
  "optimism",
  "outperform",
  "partnership",
  "positive",
  "rally",
  "rebound",
  "recovery",
  "record",
  "resilient",
  "rise",
  "rises",
  "rising",
  "strong",
  "surge",
  "surges",
  "upgrade",
]);
const negative = new Set([
  "ban",
  "banned",
  "bearish",
  "breach",
  "collapse",
  "concern",
  "crash",
  "decline",
  "declines",
  "drop",
  "drops",
  "fall",
  "falls",
  "falling",
  "fear",
  "fraud",
  "hack",
  "hacked",
  "investigation",
  "lawsuit",
  "loss",
  "losses",
  "outflow",
  "outflows",
  "panic",
  "plunge",
  "risk",
  "scam",
  "selloff",
  "slump",
  "weak",
]);
const negators = new Set([
  "not",
  "no",
  "never",
  "without",
  "isn't",
  "wasn't",
  "aren't",
  "don't",
]);
export function analyzeText(text: string): {
  score: number;
  matches: string[];
} {
  const words = text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
  let value = 0;
  const matches: string[] = [];
  words.forEach((word, index) => {
    let weight = positive.has(word) ? 1 : negative.has(word) ? -1 : 0;
    if (!weight) return;
    const negated = words
      .slice(Math.max(0, index - 3), index)
      .some((w) => negators.has(w));
    if (negated) weight *= -1;
    value += weight;
    matches.push(negated ? `not ${word}` : word);
  });
  return { score: Math.round(50 + 50 * Math.tanh(value / 2)), matches };
}
export function tone(score: number, threshold = 60): Tone {
  return score >= threshold
    ? "Bullish"
    : score <= 100 - threshold
      ? "Bearish"
      : "Neutral";
}
export function sentiment(stories: Story[], threshold = 60) {
  const score = stories.length
    ? Math.round(stories.reduce((n, s) => n + s.score, 0) / stories.length)
    : null;
  const counts = { Bullish: 0, Neutral: 0, Bearish: 0 };
  stories.forEach((story) => counts[tone(story.score, threshold)]++);
  return {
    score,
    counts,
    classified: stories.filter((s) => s.matches.length > 0).length,
  };
}
export function rsi(candles: Candle[], length = 14): number | null {
  if (candles.length <= length) return null;
  const deltas = candles.slice(1).map((c, i) => c.close - candles[i].close);
  let gain =
    deltas.slice(0, length).reduce((s, d) => s + Math.max(0, d), 0) / length;
  let loss =
    deltas.slice(0, length).reduce((s, d) => s + Math.max(0, -d), 0) / length;
  for (const delta of deltas.slice(length)) {
    gain = (gain * (length - 1) + Math.max(0, delta)) / length;
    loss = (loss * (length - 1) + Math.max(0, -delta)) / length;
  }
  if (gain === 0 && loss === 0) return 50;
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}
export function indicators(candles: Candle[]) {
  // The final exchange candle is still open; indicators use completed candles only.
  const closed = candles.slice(0, -1);
  const latestTime = candles.at(-1)?.time ?? 0;
  const session = closed.filter(
    (c) => c.time >= Math.floor(latestTime / 86400000) * 86400000,
  );
  const volume = session.reduce((sum, c) => sum + c.volume, 0);
  const vwap =
    volume > 0
      ? session.reduce((sum, c) => sum + c.vwap * c.volume, 0) / volume
      : null;
  const ranges = closed.slice(-14).map((c, i) => {
    const prev = closed[closed.length - 15 + i]?.close ?? c.open;
    return Math.max(
      c.high - c.low,
      Math.abs(c.high - prev),
      Math.abs(c.low - prev),
    );
  });
  const atr =
    ranges.length === 14 ? ranges.reduce((s, n) => s + n, 0) / 14 : null;
  const sma =
    closed.length >= 20
      ? closed.slice(-20).reduce((s, c) => s + c.close, 0) / 20
      : null;
  return { rsi: rsi(closed), vwap, atr, sma };
}
export function formatMoney(value: number | null, compact = false): string {
  return value === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: compact ? 1 : 2,
        notation: compact ? "compact" : "standard",
      }).format(value);
}
export function formatTime(
  time: number,
  timezone: "local" | "UTC" = "local",
): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(timezone === "UTC" ? { timeZone: "UTC" } : {}),
  }).format(time);
}
export function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : undefined;
  } catch {
    return;
  }
}
export function toCsv(rows: (string | number)[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell);
          // Prevent spreadsheet formula execution in externally sourced titles.
          return `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
}
