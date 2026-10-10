import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeText,
  indicators,
  rsi,
  safeUrl,
  sentiment,
  tone,
  toCsv,
} from "./analysis";
import { demoData, loadSettings, parseCandles, parseStories } from "./data";
import { DEFAULT_SETTINGS } from "./types";
import type { Candle, Story } from "./types";
const candles = (values: number[]): Candle[] =>
  values.map((close, i) => ({
    time: Date.UTC(2026, 9, 10, 12, i * 5),
    open: close,
    close,
    high: close + 1,
    low: close - 1,
    volume: 2,
    vwap: close,
  }));
const story = (title: string): Story => ({
  id: title,
  title,
  time: Date.now(),
  author: "",
  comments: 0,
  points: 0,
  ...analyzeText(title),
});

test("sentiment recognizes positive, negative, neutral and balanced wording", () => {
  assert.ok(
    analyzeText("Bitcoin sees strong growth and positive inflows").score > 75,
  );
  assert.ok(analyzeText("Crash and fraud spark fear").score < 25);
  assert.equal(analyzeText("Bitcoin changes hands on Tuesday").score, 50);
  assert.equal(analyzeText("Strong growth meets risk and fear").score, 50);
});
test("negation reverses nearby sentiment and matching ignores letter case", () => {
  assert.ok(analyzeText("Bitcoin is not bullish").score < 50);
  assert.ok(analyzeText("There is no fraud").score > 50);
  assert.equal(analyzeText("BULLISH").score, analyzeText("bullish").score);
  assert.equal(analyzeText("the neighborhood").score, 50);
});
test("sentiment scores remain bounded for long inputs and empty text", () => {
  assert.equal(analyzeText("bullish ".repeat(1000)).score, 100);
  assert.equal(analyzeText("bearish ".repeat(1000)).score, 0);
  assert.equal(analyzeText("").score, 50);
});
test("threshold boundaries are inclusive and empty samples stay unavailable", () => {
  assert.equal(tone(60), "Bullish");
  assert.equal(tone(40), "Bearish");
  assert.equal(tone(59), "Neutral");
  assert.equal(tone(65, 70), "Neutral");
  assert.equal(sentiment([]).score, null);
  const result = sentiment([
    story("bullish"),
    story("bearish"),
    story("Thursday"),
  ]);
  assert.equal(result.score, 50);
  assert.deepEqual(result.counts, { Bullish: 1, Neutral: 1, Bearish: 1 });
  assert.equal(result.classified, 2);
});
test("Wilder RSI agrees with a known 14-period calculation", () => {
  const closes = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89,
    46.03, 45.61, 46.28, 46.28,
  ];
  assert.ok(Math.abs(rsi(candles(closes))! - 70.464135) < 0.0001);
});
test("RSI handles insufficient, flat, rising and falling markets", () => {
  assert.equal(rsi(candles([1, 2, 3])), null);
  assert.equal(rsi(candles(Array(20).fill(10))), 50);
  assert.equal(rsi(candles(Array.from({ length: 20 }, (_, i) => i + 1))), 100);
  assert.equal(rsi(candles(Array.from({ length: 20 }, (_, i) => 30 - i))), 0);
});
test("indicators exclude the unfinished candle and use volume weights", () => {
  const values = candles(Array(20).fill(100));
  values.push({
    ...values[0],
    time: values.at(-1)!.time + 300000,
    close: 10000,
    vwap: 10000,
    volume: 10000,
  });
  const result = indicators(values);
  assert.equal(result.sma, 100);
  assert.equal(result.vwap, 100);
  assert.equal(result.rsi, 50);
  assert.equal(result.atr, 2);
  values[0].vwap = 120;
  values[0].volume = 20;
  assert.ok(Math.abs(indicators(values).vwap! - (2400 + 3800) / 58) < 1e-8);
});
test("new UTC session never displays yesterday’s VWAP", () => {
  const previous = candles(Array(20).fill(100)).map((c, i) => ({
    ...c,
    time: Date.UTC(2026, 9, 9, 22, 20 + i * 5),
  }));
  previous.push({ ...previous[0], time: Date.UTC(2026, 9, 10), close: 120 });
  assert.equal(indicators(previous).vwap, null);
});
test("candle parser validates provider envelopes and rejects unusable samples", () => {
  assert.throws(() =>
    parseCandles({ error: ["EGeneral:Rate limit exceeded"] }),
  );
  assert.throws(() => parseCandles({ error: [], result: { XBT: [] } }));
  const rows = candles(Array.from({ length: 31 }, (_, i) => 100 + i)).map(
    (c) => [c.time / 1000, c.open, c.high, c.low, c.close, c.vwap, c.volume, 1],
  );
  const result = parseCandles({
    error: [],
    result: { XBT: rows.reverse(), last: 1 },
  });
  assert.equal(result.length, 31);
  assert.equal(result[0].close, 100);
});
test("story parser handles duplicates and unusable items; uses safe HN links", () => {
  const hit = {
    objectID: "12",
    title: "Bitcoin bullish",
    created_at_i: 1791648000,
    author: "trader",
    num_comments: 2,
    points: 10,
    url: "javascript:alert(1)",
  };
  const results = parseStories({
    hits: [
      null,
      hit,
      hit,
      { objectID: "13", title: null },
      { ...hit, objectID: "14", created_at_i: "bad" },
    ],
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].url, "https://news.ycombinator.com/item?id=12");
  assert.ok(results[0].score > 50);
});
test("CSV handles commas, quotes, newlines and formula injection", () => {
  const result = toCsv([
    ['=WEBSERVICE("https://example.com")', "a,b", 'say "hello"', "a\nb", 42],
  ]);
  assert.ok(result.startsWith("\"'=WEBSERVICE("));
  assert.ok(result.includes('"a,b"'));
  assert.ok(result.includes('"say ""hello"""'));
  assert.ok(result.includes('"a\nb"'));
});
test("URL helper refuses script and malformed URLs", () => {
  assert.equal(safeUrl("javascript:alert(1)"), undefined);
  assert.equal(safeUrl("data:text/html,hello"), undefined);
  assert.equal(safeUrl("https://example.com/path"), "https://example.com/path");
});
test("demo data covers each supported market with explicit provenance", () => {
  for (const symbol of ["BTC", "ETH", "SOL", "LINK"] as const) {
    const d = demoData(symbol);
    assert.equal(d.mode, "demo");
    assert.equal(d.symbol, symbol);
    assert.equal(d.marketState, "demo");
    assert.equal(d.stories.length, 25);
    assert.equal(d.market!.candles.length, 360);
    assert.ok(d.market!.price > 0);
    assert.ok(d.stories.every((s) => !s.url));
  }
});
test("settings tolerate absent, corrupt, and unavailable browser storage", () => {
  assert.deepEqual(loadSettings(), DEFAULT_SETTINGS);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => "{bad" },
  });
  assert.deepEqual(loadSettings(), DEFAULT_SETTINGS);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () =>
        JSON.stringify({
          defaultAsset: "BAD",
          interval: -1,
          watchlist: ["BTC", "BAD", "BTC"],
          autoRefresh: false,
        }),
    },
  });
  const settings = loadSettings();
  assert.equal(settings.defaultAsset, "BTC");
  assert.equal(settings.interval, 60);
  assert.deepEqual(settings.watchlist, ["BTC"]);
  assert.equal(settings.autoRefresh, false);
  delete (globalThis as { localStorage?: unknown }).localStorage;
});
