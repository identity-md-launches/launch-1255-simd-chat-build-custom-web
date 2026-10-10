import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeText, indicators } from "./analysis";
import { marketDecision } from "./decision";
import type { DataSet } from "./types";

const now = Date.UTC(2026, 9, 10, 12);
function sample(direction: "long" | "short" = "long", extreme = false): DataSet {
  const sign = direction === "long" ? 1 : -1;
  const candles = Array.from({ length: 61 }, (_, i) => {
    const price = 1000 + sign * (extreme ? i : i * 0.1 + (i % 2 ? 1 : 0));
    return { time: now - (60 - i) * 300000, open: price, close: price,
      high: price + 2, low: price - 2, volume: 10, vwap: price };
  });
  const price = candles.at(-1)!.close;
  return {
    symbol: "BTC", mode: "live", updatedAt: now, errors: [],
    marketState: "live", socialState: "live", derivativesState: "unavailable", derivatives: null,
    market: { price, candles, fetchedAt: now, change: sign, high: price + 10, low: price - 10, volume: 1000 },
    stories: Array.from({ length: 5 }, (_, i) => {
      const title = direction === "long" ? "Bitcoin bullish" : "Bitcoin bearish";
      return { id: String(i), title, time: now - (i + 1) * 60000, author: "test", points: 0, comments: 0, ...analyzeText(title) };
    }),
  };
}

test("Buy and Sell require all three signals and produce mirrored, calculated ranges", () => {
  for (const side of ["long", "short"] as const) {
    const data = sample(side);
    const result = marketDecision(data, 60, undefined, now);
    assert.equal(result.action, side === "long" ? "Buy" : "Sell");
    assert.equal(result.confidence, "High");
    const levels = result.levels!;
    const atr = indicators(data.market!.candles).atr!;
    const midpoint = data.market!.price;
    assert.equal(levels.entryLow, midpoint - 0.25 * atr);
    assert.equal(levels.entryHigh, midpoint + 0.25 * atr);
    assert.equal(levels.direction, side);
    if (side === "long") {
      assert.ok(levels.stop < levels.entryLow && levels.target > levels.entryHigh);
      assert.equal(levels.stop, midpoint - 1.5 * atr);
      assert.equal(levels.target, midpoint + 3 * atr);
    } else {
      assert.ok(levels.stop > levels.entryHigh && levels.target < levels.entryLow);
      assert.equal(levels.stop, midpoint + 1.5 * atr);
      assert.equal(levels.target, midpoint - 3 * atr);
    }
    assert.equal(Math.abs((levels.target - midpoint) / (midpoint - levels.stop)), 2);
  }
});

test("Conflicting signals, neutral sentiment, and RSI extremes Hold without entry levels", () => {
  const data = sample();
  data.stories = sample("short").stories;
  assert.equal(marketDecision(data, 60, undefined, now).action, "Hold");
  for (const side of ["long", "short"] as const) {
    const decision = marketDecision(sample(side, true), 60, undefined, now);
    assert.equal(decision.action, "Hold");
    assert.equal(decision.confidence, "Low");
    assert.equal(decision.levels, null);
  }
  data.stories = data.stories.map(s => ({ ...s, score: 50, matches: [] }));
  assert.equal(marketDecision(data, 60, undefined, now).action, "Hold");
});

test("Sentiment threshold changes the recommendation at the inclusive boundary", () => {
  const data = sample();
  data.stories = data.stories.map(s => ({ ...s, score: 60 }));
  assert.equal(marketDecision(data, 60, undefined, now).action, "Buy");
  assert.equal(marketDecision(data, 65, undefined, now).action, "Hold");
  const short = sample("short");
  short.stories = short.stories.map(s => ({ ...s, score: 40 }));
  assert.equal(marketDecision(short, 60, undefined, now).action, "Sell");
  assert.equal(marketDecision(short, 65, undefined, now).action, "Hold");
});

test("Confidence declines with sparse samples and lower keyword coverage", () => {
  const data = sample();
  data.stories = data.stories.slice(0, 4);
  assert.equal(marketDecision(data, 60, undefined, now).confidence, "Low");
  const five = sample();
  five.stories[0].matches = [];
  assert.equal(marketDecision(five, 60, undefined, now).confidence, "High");
  five.stories[1].matches = [];
  assert.equal(marketDecision(five, 60, undefined, now).confidence, "Moderate");
  five.stories[2].matches = [];
  assert.equal(marketDecision(five, 60, undefined, now).confidence, "Low");
});

test("Take Profit needs a supplied profitable long or short AND an extreme RSI", () => {
  for (const side of ["long", "short"] as const) {
    const data = sample(side, true);
    const price = data.market!.price;
    const goodEntry = price + (side === "long" ? -5 : 5);
    const badEntry = price + (side === "long" ? 5 : -5);
    const decision = marketDecision(data, 60, { side, entry: goodEntry }, now);
    assert.equal(decision.action, "Take Profit");
    assert.equal(decision.levels, null);
    assert.match(decision.rationale, /before costs/);
    assert.equal(marketDecision(data, 60, { side, entry: badEntry }, now).action, "Hold");
    assert.equal(marketDecision(data, 60, { side, entry: price }, now).action, "Hold");
    assert.equal(marketDecision(sample(side), 60, { side, entry: 1000 }, now).action, "Hold");
    for (const entry of [null, 0, -1, NaN, Infinity])
      assert.equal(marketDecision(data, 60, { side, entry }, now).action, null);
  }
});

test("Missing, stale and invalid required data never yield actionable levels or confidence", () => {
  const mutations: ((data: DataSet) => void)[] = [
    d => { d.market = null; },
    d => { d.marketState = "unavailable"; },
    d => { d.socialState = "unavailable"; },
    d => { d.stories = []; },
    d => { d.market!.price = NaN; },
    d => { d.market!.fetchedAt = now - 600000; },
    d => { d.market!.fetchedAt = now + 120000; },
    d => { d.market!.candles = d.market!.candles.map(c => ({ ...c, time: c.time - 600000 })); },
    d => { d.market!.candles = d.market!.candles.slice(-10); },
    d => { d.market!.candles = d.market!.candles.map(c => ({ ...c, volume: 0 })); },
    d => { d.stories = d.stories.map(s => ({ ...s, time: now - 86400000 })); },
    d => { d.stories = d.stories.map(s => ({ ...s, time: now + 1000 })); },
    d => { d.market!.candles = d.market!.candles.map(c => ({ ...c, high: c.close + 1000 })); },
  ];
  for (const mutate of mutations) {
    const data = sample("short");
    mutate(data);
    const decision = marketDecision(data, 60, undefined, now);
    assert.equal(decision.action, null, decision.rationale);
    assert.equal(decision.confidence, "Unavailable");
    assert.equal(decision.levels, null);
  }
});

test("Old/future headlines do not contaminate the fresh decision sample", () => {
  const data = sample();
  const irrelevant = sample("short").stories.map(s => ({ ...s, time: now - 86400000 }));
  data.stories.push(...irrelevant, ...irrelevant.map(s => ({ ...s, time: now + 1000 })));
  const decision = marketDecision(data, 60, undefined, now);
  assert.equal(decision.action, "Buy");
  assert.equal(decision.sampleCount, 5);
});

test("Demo decisions use their labeled snapshot while paused live decisions expire", () => {
  const data = sample();
  assert.equal(marketDecision(data, 60, undefined, now + 600000).action, null);
  data.mode = "demo";
  data.marketState = data.socialState = "demo";
  assert.equal(marketDecision(data, 60, undefined, now + 86400000).action, "Buy");
});
