import { analyzeText } from "./analysis";
import { ASSETS, DEFAULT_SETTINGS } from "./types";
import type {
  Candle,
  DataSet,
  Derivatives,
  Market,
  Settings,
  Story,
  Symbol,
} from "./types";

export function loadSettings(): Settings {
  try {
    const data = JSON.parse(localStorage.getItem("pulse-settings") ?? "null");
    if (!data || typeof data !== "object") return DEFAULT_SETTINGS;
    const validAsset = (a: unknown): a is Symbol =>
      ASSETS.some((v) => v.symbol === a);
    return {
      defaultAsset: validAsset(data.defaultAsset) ? data.defaultAsset : "BTC",
      interval: [30, 60, 120, 300].includes(data.interval) ? data.interval : 60,
      autoRefresh:
        typeof data.autoRefresh === "boolean" ? data.autoRefresh : true,
      sampleSize: [10, 25, 50, 100].includes(data.sampleSize)
        ? data.sampleSize
        : 50,
      timezone: data.timezone === "UTC" ? "UTC" : "local",
      threshold: [55, 60, 65, 70].includes(data.threshold)
        ? data.threshold
        : 60,
      watchlist: Array.isArray(data.watchlist)
        ? [...new Set<Symbol>(data.watchlist.filter(validAsset))]
        : DEFAULT_SETTINGS.watchlist,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
async function request(url: string, signal: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(12000);
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, timeout]),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
function record(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Unexpected response");
  return data as Record<string, unknown>;
}
function krakenResult(data: unknown) {
  const body = record(data);
  if (!Array.isArray(body.error) || body.error.length)
    throw new Error("Exchange response unavailable");
  return record(body.result);
}
export function parseCandles(body: unknown): Candle[] {
  const result = krakenResult(body);
  const raw = Object.entries(result).find(([key]) => key !== "last")?.[1];
  if (!Array.isArray(raw)) throw new Error("Missing candles");
  const candles = raw
    .filter(Array.isArray)
    .map((row) => ({
      time: Number(row[0]) * 1000,
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      vwap: Number(row[5]),
      volume: Number(row[6]),
    }))
    .filter(
      (c) =>
        Object.values(c).every(Number.isFinite) &&
        c.close > 0 &&
        c.volume >= 0 &&
        c.time > 0,
    )
    .sort((a, b) => a.time - b.time);
  if (candles.length < 30) throw new Error("Not enough valid candles");
  return candles;
}
async function getMarket(symbol: Symbol, signal: AbortSignal): Promise<Market> {
  const asset = ASSETS.find((a) => a.symbol === symbol)!;
  const [candleData, tickerData] = await Promise.all([
    request(
      `https://api.kraken.com/0/public/OHLC?pair=${asset.pair}&interval=5`,
      signal,
    ),
    request(
      `https://api.kraken.com/0/public/Ticker?pair=${asset.pair}`,
      signal,
    ),
  ]);
  const candles = parseCandles(candleData);
  const ticker = record(Object.values(krakenResult(tickerData))[0]);
  const value = (key: string, index = 0) =>
    Number(Array.isArray(ticker[key]) ? ticker[key][index] : ticker[key]);
  const price = value("c");
  // Kraken's open is midnight UTC. Label this as the UTC-day change, never 24h change.
  const change = (price / value("o") - 1) * 100;
  const volume = value("v", 1) * value("p", 1);
  if (
    ![price, change, volume, value("h", 1), value("l", 1)].every(
      Number.isFinite,
    ) ||
    price <= 0
  )
    throw new Error("Invalid ticker");
  return {
    candles,
    price,
    change,
    volume,
    high: value("h", 1),
    low: value("l", 1),
    fetchedAt: Date.now(),
  };
}
export function parseStories(data: unknown): Story[] {
  const body = record(data);
  if (!Array.isArray(body.hits)) throw new Error("Missing stories");
  const seen = new Set<string>();
  return body.hits.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const hit = record(item);
    if (
      typeof hit.title !== "string" ||
      !hit.title.trim() ||
      typeof hit.objectID !== "string" ||
      seen.has(hit.objectID)
    )
      return [];
    seen.add(hit.objectID);
    const time = Number(hit.created_at_i) * 1000;
    if (
      !Number.isFinite(time) ||
      time <= 0 ||
      !Number.isFinite(new Date(time).getTime())
    )
      return [];
    return [
      {
        id: hit.objectID,
        title: hit.title,
        time,
        url: `https://news.ycombinator.com/item?id=${encodeURIComponent(hit.objectID)}`,
        author: typeof hit.author === "string" ? hit.author : "HN contributor",
        points: Number(hit.points) || 0,
        comments: Number(hit.num_comments) || 0,
        ...analyzeText(hit.title),
      },
    ];
  });
}
async function getStories(symbol: Symbol, sample: number, signal: AbortSignal) {
  const query = ASSETS.find((a) => a.symbol === symbol)!.query;
  const since = Math.floor(Date.now() / 1000) - 7 * 86400;
  return parseStories(
    await request(
      `https://hn.algolia.com/api/v1/search_by_date?query=${query}&tags=story&hitsPerPage=${sample}&numericFilters=created_at_i%3E${since}`,
      signal,
    ),
  );
}
async function getDerivatives(
  symbol: Symbol,
  signal: AbortSignal,
): Promise<Derivatives> {
  const pair = `${symbol}USDT`;
  const [fundingData, interestData] = await Promise.all([
    request(
      `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${pair}`,
      signal,
    ),
    request(
      `https://fapi.binance.com/fapi/v1/openInterest?symbol=${pair}`,
      signal,
    ),
  ]);
  const premium = record(fundingData),
    interest = record(interestData);
  const funding = Number(premium.lastFundingRate) * 100;
  const openInterest = Number(interest.openInterest);
  const time = Number(premium.time);
  if (
    ![funding, openInterest, time].every(Number.isFinite) ||
    time <= 0 ||
    openInterest < 0
  )
    throw new Error("Incomplete derivatives");
  return { funding, openInterest, time };
}
export async function fetchLive(
  symbol: Symbol,
  sample: number,
  signal: AbortSignal,
): Promise<DataSet> {
  const [market, social, derivatives] = await Promise.allSettled([
    getMarket(symbol, signal),
    getStories(symbol, sample, signal),
    getDerivatives(symbol, signal),
  ]);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const errors: string[] = [];
  if (market.status === "rejected")
    errors.push(
      "Market prices are unavailable. Check your connection and try Analyze market again.",
    );
  if (social.status === "rejected")
    errors.push(
      "Conversation data is unavailable. Retry or analyze your own text below.",
    );
  if (derivatives.status === "rejected")
    errors.push("Perpetual futures data is unavailable.");
  return {
    symbol,
    mode: "live",
    market: market.status === "fulfilled" ? market.value : null,
    stories: social.status === "fulfilled" ? social.value : [],
    derivatives: derivatives.status === "fulfilled" ? derivatives.value : null,
    marketState: market.status === "fulfilled" ? "live" : "unavailable",
    socialState: social.status === "fulfilled" ? "live" : "unavailable",
    derivativesState:
      derivatives.status === "fulfilled" ? "live" : "unavailable",
    errors,
    updatedAt: Date.now(),
  };
}
const demoTitles = [
  "Bitcoin adoption grows as new payment partnerships launch",
  "Institutional inflows support a resilient crypto market",
  "A closer look at Bitcoin’s latest network upgrade",
  "Bitcoin breaks resistance as buyers return",
  "Crypto exchange volumes rebound after a quiet session",
  "Traders weigh inflation data ahead of the next session",
  "Bitcoin rally continues as spot demand rises",
  "Short-term holders face losses after sharp pullback",
  "New research explores the future of digital assets",
  "Bitcoin ETF inflows reach a new weekly high",
  "Market volatility sparks concern among traders",
  "Developers announce a major privacy upgrade",
  "Bitcoin price holds steady near the session midpoint",
  "Institutional adoption gains momentum across Europe",
  "Crypto market outlook: the levels to watch today",
  "Analysts see strong growth in on-chain activity",
  "Bitcoin drops as leveraged positions unwind",
  "New exchange partnership expands access to Bitcoin",
  "A guide to understanding Bitcoin transaction fees",
  "Spot demand rises alongside positive market momentum",
  "Bitcoin traders await the next economic release",
  "Digital asset funds report fresh inflows",
  "Crypto security breach renews investor concern",
  "Bitcoin mining activity reaches a milestone",
  "Market participants assess the latest policy update",
];
export function demoData(symbol: Symbol): DataSet {
  const base = { BTC: 67432.8, ETH: 3518.42, SOL: 148.62, LINK: 14.86 }[symbol];
  const now = Math.floor(Date.now() / 300000) * 300000;
  const candles: Candle[] = Array.from({ length: 360 }, (_, i) => {
    const wave =
      Math.sin(i * 0.19) * 0.0018 +
      Math.sin(i * 0.81) * 0.0007 +
      Math.sin(i * 0.043) * 0.004;
    const close = base * (0.975 + (i / 360) * 0.025 + wave);
    const open = close * (1 + Math.sin(i * 1.3) * 0.0008);
    return {
      time: now - (359 - i) * 300000,
      open,
      close,
      high: Math.max(open, close) * 1.0006,
      low: Math.min(open, close) * 0.9994,
      volume: 12 + (1 + Math.sin(i * 0.73)) * 36,
      vwap: (open + close) / 2,
    };
  });
  const price = candles.at(-1)!.close;
  const name = ASSETS.find((a) => a.symbol === symbol)!.name;
  const stories = demoTitles.map((text, i) => {
    const title = text.replaceAll("Bitcoin", name);
    return {
      id: `demo-${i}`,
      title,
      time: now - (i * 47 + 3) * 60000,
      author: "Example headline",
      points: 10 + i * 3,
      comments: 2 + i,
      ...analyzeText(title),
    };
  });
  return {
    symbol,
    mode: "demo",
    market: {
      price,
      change: 2.34,
      volume: base * 6842,
      high: price * 1.012,
      low: price * 0.969,
      candles,
      fetchedAt: now,
    },
    stories,
    derivatives: { funding: 0.0012, openInterest: 12483, time: now },
    marketState: "demo",
    socialState: "demo",
    derivativesState: "demo",
    errors: [],
    updatedAt: now,
  };
}
