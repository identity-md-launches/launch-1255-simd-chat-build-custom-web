import { indicators, sentiment, tone } from "./analysis";
import type { DataSet } from "./types";

export type Position = { side: "none" | "long" | "short"; entry: number | null };
export interface Decision {
  action: "Buy" | "Sell" | "Hold" | "Take Profit" | null;
  rationale: string;
  confidence: "High" | "Moderate" | "Low" | "Unavailable";
  confidenceReason: string;
  factors: { label: string; direction: "long" | "short" | null }[];
  sampleCount: number;
  levels: {
    direction: "long" | "short";
    entryLow: number;
    entryHigh: number;
    midpoint: number;
    stop: number;
    target: number;
  } | null;
  levelsReason: string;
}

// Deliberately transparent research rules, not a fitted or calibrated model.
export function marketDecision(
  data: DataSet,
  threshold: number,
  position: Position = { side: "none", entry: null },
  now = Date.now(),
): Decision {
  const asOf = data.mode === "demo" ? data.updatedAt : now;
  const fresh = data.stories.filter(
    (s) => s.time <= asOf && s.time > asOf - 86400000 && Number.isFinite(s.score),
  );
  const stats = sentiment(fresh, threshold);
  const tech = indicators(data.market?.candles ?? []);
  const price = data.market?.price;
  const sentimentDirection: "long" | "short" | null = stats.score === null ? null
    : tone(stats.score, threshold) === "Bullish" ? "long"
    : tone(stats.score, threshold) === "Bearish" ? "short" : null;
  const priceDirection: "long" | "short" | null = price === undefined || tech.vwap === null ? null
    : price > tech.vwap ? "long" : price < tech.vwap ? "short" : null;
  const rsiDirection: "long" | "short" | null = tech.rsi === null ? null
    : tech.rsi > 50 && tech.rsi < 70 ? "long"
    : tech.rsi < 50 && tech.rsi > 30 ? "short" : null;
  const result: Decision = {
    action: null,
    rationale: "",
    confidence: "Unavailable",
    confidenceReason: "Confidence needs current prices, indicators, and a fresh conversation sample.",
    sampleCount: fresh.length,
    factors: [
      {
        label: stats.score === null
          ? "No headlines in the last 24 hours"
          : `${tone(stats.score, threshold)} fresh sentiment · ${stats.score}/100 (${fresh.length} headlines)`,
        direction: sentimentDirection,
      },
      {
        label: price === undefined || tech.vwap === null ? "Session VWAP unavailable"
          : `Price ${price > tech.vwap ? "above" : price < tech.vwap ? "below" : "at"} session VWAP`,
        direction: priceDirection,
      },
      {
        label: tech.rsi === null ? "RSI unavailable"
          : `RSI ${tech.rsi.toFixed(1)} · ${tech.rsi >= 70 ? "overbought" : tech.rsi <= 30 ? "oversold" : tech.rsi > 50 ? "positive momentum" : tech.rsi < 50 ? "negative momentum" : "neutral momentum"}`,
        direction: rsiDirection,
      },
    ],
    levels: null,
    levelsReason: "No entry levels while the decision is unavailable.",
  };
  const unavailable = (reason: string): Decision => ({
    ...result, action: null, confidence: "Unavailable", rationale: reason,
    confidenceReason: "A required input or valid price range is missing. No confidence assessment is available.",
  });
  if (!data.market || data.marketState === "unavailable" || !Number.isFinite(price) || price! <= 0)
    return unavailable("Market prices are unavailable. Select Analyze market to retry.");
  const lastClosed = data.market.candles.at(-2)?.time ?? 0;
  if (![data.market.fetchedAt, lastClosed].every(Number.isFinite) ||
      asOf - data.market.fetchedAt >= 600000 || data.market.fetchedAt > asOf + 60000 ||
      asOf - lastClosed >= 900000 || lastClosed > asOf)
    return unavailable("Price data is stale or its timestamps are invalid. Select Analyze market to refresh.");
  if (data.socialState === "unavailable" || stats.score === null)
    return unavailable("No fresh conversation sample in the last 24 hours. Retry Analyze market when new headlines are available.");
  if (tech.rsi === null || !Number.isFinite(tech.rsi) || tech.rsi < 0 || tech.rsi > 100 ||
      tech.vwap === null || !Number.isFinite(tech.vwap) || tech.vwap <= 0 ||
      tech.atr === null || !Number.isFinite(tech.atr) || tech.atr <= 0)
    return unavailable("Indicators are incomplete or volatility is zero. Wait for completed candles in this UTC session, then retry.");
  if (position.side !== "none" &&
      (position.entry === null || !Number.isFinite(position.entry) || position.entry <= 0))
    return unavailable("Enter a positive average entry price for your position, or select No position.");

  const matchedShare = stats.classified / fresh.length;
  result.confidence = fresh.length < 5 || matchedShare < 0.5 ? "Low"
    : matchedShare < 0.8 ? "Moderate" : "High";
  result.confidenceReason = `${fresh.length} fresh headlines; ${stats.classified} contain recognized sentiment words. `;
  const profitable = position.side === "long" ? price! > position.entry!
    : position.side === "short" && price! < position.entry!;
  const stretched = position.side === "long" ? tech.rsi >= 70
    : position.side === "short" && tech.rsi <= 30;
  if (position.side !== "none") {
    if (profitable && stretched) {
      result.action = "Take Profit";
      result.rationale = `The supplied ${position.side} position is profitable before costs and RSI is ${position.side === "long" ? "at least 70" : "at most 30"}. Review taking profit on that position.`;
      result.confidenceReason += "Both profit-taking conditions are met.";
    } else {
      result.action = "Hold";
      result.confidence = "Low";
      result.rationale = `No profit-taking trigger for the supplied ${position.side} position: ${!profitable ? "the latest price does not show a profit before costs" : "RSI has not reached the profit-taking threshold"}. Review the signals and your own exit plan.`;
      result.confidenceReason += "The profit-taking conditions are not both met; Hold is not an assurance that the position is safe.";
    }
    result.levelsReason = "No new entry range for an existing position. Take Profit reviews an exit; it does not open or reverse a trade.";
    return result;
  }
  const direction = sentimentDirection && sentimentDirection === priceDirection && sentimentDirection === rsiDirection
    ? sentimentDirection : null;
  if (!direction) {
    result.action = "Hold";
    result.confidence = "Low";
    result.rationale = "Sentiment, price versus VWAP, and non-extreme RSI do not agree on an entry. Wait for alignment before considering a new position.";
    result.confidenceReason += "Fewer than three entry signals agree.";
    result.levelsReason = "No entry range while signals disagree or RSI is stretched. Reanalyze when conditions change.";
    return result;
  }
  const sign = direction === "long" ? 1 : -1;
  const levels = {
    direction,
    entryLow: price! - tech.atr * 0.25,
    entryHigh: price! + tech.atr * 0.25,
    midpoint: price!,
    stop: price! - sign * tech.atr * 1.5,
    target: price! + sign * tech.atr * 3,
  };
  if (![levels.entryLow, levels.entryHigh, levels.stop, levels.target].every((v) => Number.isFinite(v) && v > 0))
    return unavailable("Volatility produces unusable price levels. Wait for a valid range, then retry Analyze market.");
  result.action = direction === "long" ? "Buy" : "Sell";
  result.rationale = `${direction === "long" ? "Bullish" : "Bearish"} fresh sentiment, price ${direction === "long" ? "above" : "below"} session VWAP, and RSI ${direction === "long" ? "between 50 and 70" : "between 30 and 50"} align. Review the ${direction} entry range before acting.`;
  result.confidenceReason += "All three entry signals agree.";
  result.levels = levels;
  result.levelsReason = "";
  return result;
}
