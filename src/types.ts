export type Symbol = "BTC" | "ETH" | "SOL" | "LINK";
export type Tone = "Bullish" | "Neutral" | "Bearish";
export type Period = "1H" | "4H" | "1D";
export type SourceState = "demo" | "live" | "unavailable";
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
}
export interface Story {
  id: string;
  title: string;
  time: number;
  url?: string;
  author: string;
  points: number;
  comments: number;
  score: number;
  matches: string[];
}
export interface Market {
  candles: Candle[];
  price: number;
  change: number;
  volume: number;
  high: number;
  low: number;
  fetchedAt: number;
}
export interface Derivatives {
  funding: number;
  openInterest: number;
  time: number;
}
export interface DataSet {
  symbol: Symbol;
  mode: "demo" | "live";
  market: Market | null;
  stories: Story[];
  derivatives: Derivatives | null;
  marketState: SourceState;
  socialState: SourceState;
  derivativesState: SourceState;
  updatedAt: number;
  errors: string[];
}
export interface Settings {
  defaultAsset: Symbol;
  interval: number;
  autoRefresh: boolean;
  sampleSize: number;
  timezone: "local" | "UTC";
  threshold: number;
  watchlist: Symbol[];
}
export const ASSETS = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    pair: "XBTUSD",
    query: "bitcoin",
    glyph: "₿",
    color: "bitcoin",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    pair: "ETHUSD",
    query: "ethereum",
    glyph: "Ξ",
    color: "ethereum",
  },
  {
    symbol: "SOL",
    name: "Solana",
    pair: "SOLUSD",
    query: "solana",
    glyph: "≋",
    color: "solana",
  },
  {
    symbol: "LINK",
    name: "Chainlink",
    pair: "LINKUSD",
    query: "chainlink",
    glyph: "⬡",
    color: "chainlink",
  },
] as const;
export const DEFAULT_SETTINGS: Settings = {
  defaultAsset: "BTC",
  interval: 60,
  autoRefresh: true,
  sampleSize: 50,
  timezone: "local",
  threshold: 60,
  watchlist: ["BTC", "ETH", "SOL"],
};
