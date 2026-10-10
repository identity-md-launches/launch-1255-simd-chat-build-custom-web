import { useMemo, useRef, useState } from "react";
import {
  analyzeText,
  formatMoney,
  formatTime,
  indicators,
  sentiment,
  tone,
  toCsv,
} from "../analysis";
import { ASSETS } from "../types";
import type { DataSet, Settings, Story, Symbol, Tone } from "../types";
import Chart, { Sparkline } from "./Chart";
import Icon from "./Icon";

function SentimentBadge({
  score,
  threshold,
}: {
  score: number;
  threshold: number;
}) {
  const value = tone(score, threshold);
  return (
    <span className={`badge ${value.toLowerCase()}`}>
      {value === "Bullish" ? "↗" : value === "Bearish" ? "↘" : "−"} {value}
    </span>
  );
}
function download(data: DataSet, threshold: number) {
  const stats = sentiment(data.stories, threshold);
  const tech = indicators(data.market?.candles ?? []);
  const rows: (string | number)[][] = [
    ["Pulse analysis export"],
    ["Asset", data.symbol],
    ["Mode", data.mode],
    ["Fetched at (UTC)", new Date(data.updatedAt).toISOString()],
    ["Market source status", data.marketState],
    ["Social source status", data.socialState],
    ["Derivatives source status", data.derivativesState],
    [
      "Derivatives source",
      data.mode === "demo" ? "Illustrative data" : "Binance USDT perpetuals",
    ],
    [
      "Sentiment source",
      data.mode === "demo"
        ? "Illustrative example headlines"
        : "Hacker News via Algolia; last 7 days",
    ],
    ["Sentiment score", stats.score ?? "Unavailable"],
    ["Price USD", data.market?.price ?? "Unavailable"],
    ["UTC-day change %", data.market?.change ?? "Unavailable"],
    ["24h volume USD", data.market?.volume ?? "Unavailable"],
    ["RSI 14", tech.rsi ?? "Unavailable"],
    ["Session VWAP", tech.vwap ?? "Unavailable"],
    ["SMA 20", tech.sma ?? "Unavailable"],
    ["ATR 14", tech.atr ?? "Unavailable"],
    [
      "Funding % last reported period",
      data.derivatives?.funding ?? "Unavailable",
    ],
    [
      "Open interest (asset units)",
      data.derivatives?.openInterest ?? "Unavailable",
    ],
    [],
    ["Title", "Published UTC", "Score", "Tone", "Matched words", "Source URL"],
    ...data.stories.map((s) => [
      s.title,
      new Date(s.time).toISOString(),
      s.score,
      tone(s.score, threshold),
      s.matches.join("; "),
      s.url ?? "Demo",
    ]),
  ];
  const blob = new Blob(["\uFEFF", toCsv(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pulse-${data.symbol.toLowerCase()}-${data.mode}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function TextAnalyzer({ threshold }: { threshold: number }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Story[] | null>(null);
  const [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const summary = result ? sentiment(result, threshold) : null;
  return (
    <div className="text-analyzer">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const lines = text
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          if (!lines.length || lines.length > 1000 || text.length > 200000) {
            setError(
              !lines.length
                ? "Paste at least one headline to analyze."
                : "Use up to 1,000 lines and 200,000 characters per analysis.",
            );
            input.current?.focus();
            return;
          }
          setError("");
          setResult(
            lines.map((title, i) => ({
              id: `local-${i}`,
              title,
              time: Date.now(),
              author: "Your text",
              points: 0,
              comments: 0,
              ...analyzeText(title),
            })),
          );
        }}
      >
        <label htmlFor="headlines">Headlines or posts</label>
        <p id="text-hint">
          One per line, up to 1,000. Analyzed on this device; never uploaded.
        </p>
        <textarea
          ref={input}
          id="headlines"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
            if (error) setError("");
          }}
          rows={5}
          placeholder="Bitcoin adoption grows as payment network expands…"
          aria-describedby={`text-hint${error ? " text-error" : ""}`}
          aria-invalid={!!error}
        />
        {error && (
          <p id="text-error" className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="text-actions">
          <span>
            <Icon name="shield" size={14} /> Private, local analysis
          </span>
          <button className="button secondary" type="submit">
            <Icon name="activity" size={16} />
            Analyze headlines
          </button>
        </div>
      </form>
      <div role="status" className="sr-only">
        {summary
          ? `Analyzed ${result!.length} headlines. Sentiment score ${summary.score} out of 100.`
          : ""}
      </div>
      {result && summary && (
        <div className="local-results">
          <div className="local-summary">
            <div>
              <span className="subtle">Your text sentiment</span>
              <strong className="num">
                {summary.score}
                <small>/100</small>
              </strong>
            </div>
            <SentimentBadge score={summary.score!} threshold={threshold} />
            <span>
              {result.length} headline{result.length === 1 ? "" : "s"} ·{" "}
              {summary.classified} with matched words
            </span>
          </div>
          <ul>
            {result.slice(0, 100).map((s) => (
              <li key={s.id}>
                <div>
                  <p>{s.title}</p>
                  <small>
                    {s.matches.length
                      ? `Matched: ${s.matches.join(", ")}`
                      : "No sentiment words matched"}
                  </small>
                </div>
                <SentimentBadge score={s.score} threshold={threshold} />
              </li>
            ))}
          </ul>
          {result.length > 100 && (
            <p>
              Showing the first 100 results. All {result.length} headlines are
              included in the score.
            </p>
          )}
          <p className="small-note">
            Local text results are separate from the market dashboard.
          </p>
        </div>
      )}
    </div>
  );
}

export default function Dashboard({
  data,
  settings,
  symbol,
  busy,
  paused,
  onSymbol,
  onAnalyze,
  onPause,
  onDemo,
  announce,
}: {
  data: DataSet;
  settings: Settings;
  symbol: Symbol;
  busy: boolean;
  paused: boolean;
  onSymbol: (symbol: Symbol) => void;
  onAnalyze: () => void;
  onPause: () => void;
  onDemo: () => void;
  announce: (message: string) => void;
}) {
  const [filter, setFilter] = useState<Tone | "All">("All");
  const [showAll, setShowAll] = useState(false);
  const [feedMode, setFeedMode] = useState<"feed" | "text">("feed");
  const [levels, setLevels] = useState(false);
  const stats = useMemo(
    () => sentiment(data.stories, settings.threshold),
    [data.stories, settings.threshold],
  );
  const tech = useMemo(
    () => indicators(data.market?.candles ?? []),
    [data.market],
  );
  const asset = ASSETS.find((a) => a.symbol === symbol)!;
  const filtered = data.stories.filter(
    (s) => filter === "All" || tone(s.score, settings.threshold) === filter,
  );
  const visible = showAll ? filtered : filtered.slice(0, 4);
  const sourceLabel = busy
    ? "Updating…"
    : data.mode === "demo"
      ? "Demo data"
      : data.errors.length
        ? "Partial data"
        : "Public data";
  const newestStoryTime = data.stories.length
    ? Math.max(...data.stories.map((story) => story.time))
    : null;
  const headlineAgeHours =
    newestStoryTime === null
      ? 0
      : Math.floor((Date.now() - newestStoryTime) / 3600000);
  const staleSocial = data.mode === "live" && headlineAgeHours >= 24;
  const bullishFactors = [
    !staleSocial && stats.score !== null && stats.score >= settings.threshold,
    data.market && tech.vwap !== null && data.market.price > tech.vwap,
    tech.rsi !== null && tech.rsi >= 50 && tech.rsi < 70,
  ].filter(Boolean).length;
  const complete = !!data.market && stats.score !== null && !staleSocial;
  const bias =
    staleSocial && data.market
      ? "Wait for fresh context"
      : !complete
        ? "Wait for more data"
        : bullishFactors >= 2
          ? "Bullish lean"
          : bullishFactors === 0
            ? "Cautious outlook"
            : "Mixed signals";
  const toneClass =
    bullishFactors >= 2 && complete ? "positive" : "neutral-text";
  const staleMinutes = data.market
    ? Math.floor((Date.now() - (data.market.candles.at(-1)?.time ?? 0)) / 60000)
    : 0;
  const sentimentLabel =
    stats.score === null ? "No sample" : tone(stats.score, settings.threshold);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="heading-with-badge">
            <h1>Market overview</h1>
            <span
              className={`badge ${data.mode === "demo" ? "neutral" : data.errors.length ? "warning" : "live"}`}
            >
              <span className="status-dot" />
              {sourceLabel}
            </span>
          </div>
          <p>A clearer read on the market. Your next move starts here.</p>
        </div>
        <div className="heading-actions">
          <button
            className="button secondary export-button"
            onClick={() => {
              download(data, settings.threshold);
              announce("Analysis exported as a CSV file.");
            }}
          >
            <Icon name="download" size={17} />
            Export
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={onAnalyze}
          >
            <Icon
              name={busy ? "refresh" : "activity"}
              className={busy ? "spinning" : ""}
              size={18}
            />
            {busy ? "Analyzing…" : "Analyze market"}
          </button>
        </div>
      </div>
      <div className="market-toolbar">
        <div className="market-select-wrap">
          <span className={`coin ${asset.color}`}>{asset.glyph}</span>
          <div>
            <label htmlFor="market-select">Your market</label>
            <select
              id="market-select"
              value={symbol}
              onChange={(e) => {
                onSymbol(e.target.value as Symbol);
                setFilter("All");
                setShowAll(false);
              }}
            >
              {ASSETS.map((a) => (
                <option value={a.symbol} key={a.symbol}>
                  {a.name} · {a.symbol} / USD
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="toolbar-meta">
          <span>
            <Icon name="clock" size={15} />
            {data.mode === "demo"
              ? "Example session"
              : `Fetched ${formatTime(data.updatedAt, settings.timezone)}${settings.timezone === "UTC" ? " UTC" : ""}`}
          </span>
          <button
            className={`refresh-control ${paused || !settings.autoRefresh ? "is-paused" : ""}`}
            onClick={onPause}
            disabled={data.mode === "demo"}
            aria-label={
              paused || !settings.autoRefresh
                ? "Resume automatic refresh"
                : "Pause automatic refresh"
            }
          >
            <Icon
              name={paused || !settings.autoRefresh ? "play" : "pause"}
              size={14}
            />
            {data.mode === "demo"
              ? "Preview mode"
              : paused || !settings.autoRefresh
                ? "Refresh paused"
                : `Refresh every ${settings.interval}s`}
          </button>
        </div>
      </div>
      <div
        className={`data-notice ${data.errors.length || staleSocial ? "notice-warning" : ""}`}
      >
        <Icon name="info" size={16} />
        <p>
          {data.mode === "demo" ? (
            <>
              You’re exploring demo data. <strong>Analyze market</strong> to
              load the latest public data.
            </>
          ) : data.errors.length ? (
            data.errors.join(" ")
          ) : (
            <>
              Connected to public sources. Headlines cover up to 7 days; market
              candles update every 5 minutes.
            </>
          )}
          {staleSocial && (
            <strong>
              {" "}
              Newest headline is {headlineAgeHours} hours old. Treat sentiment
              as background context, not an intraday signal.
            </strong>
          )}
          {data.mode === "live" && staleMinutes > 15 && (
            <strong>
              {" "}
              Latest price candle is {staleMinutes} minutes old; check the
              source before using it.
            </strong>
          )}
        </p>
        {data.mode === "live" && (
          <button className="text-button" onClick={onDemo}>
            Use demo
          </button>
        )}
      </div>
      <section className="metric-grid" aria-label="Market at a glance">
        <div className="panel metric-card">
          <div className="metric-label">
            Sentiment score
            <Icon name="activity" size={17} />
          </div>
          <div className="metric-main">
            <strong className="num">
              {stats.score ?? "—"}
              <small>/100</small>
            </strong>
            {stats.score !== null && (
              <SentimentBadge
                score={stats.score}
                threshold={settings.threshold}
              />
            )}
          </div>
          <div className="sentiment-meter" aria-hidden="true">
            <span style={{ width: `${stats.score ?? 0}%` }} />
          </div>
          <p>
            {stats.score === null
              ? "No headlines available"
              : `${sentimentLabel} tone across ${data.stories.length} headlines`}
          </p>
        </div>
        <div className="panel metric-card">
          <div className="metric-label">
            {asset.name} price<span className="metric-unit">USD</span>
          </div>
          <div className="metric-main">
            <strong className="num price-number">
              {formatMoney(data.market?.price ?? null)}
            </strong>
          </div>
          <div className="metric-bottom">
            <div>
              {data.market && (
                <span
                  className={`change ${data.market.change >= 0 ? "positive" : "negative"}`}
                >
                  {data.market.change >= 0 ? "↗ +" : "↘ "}
                  {data.market.change.toFixed(2)}%
                </span>
              )}
              <p>Since midnight UTC</p>
            </div>
            <Sparkline
              values={data.market?.candles.slice(-50).map((c) => c.close) ?? []}
            />
          </div>
        </div>
        <div className="panel metric-card">
          <div className="metric-label">
            Relative strength
            <Icon name="chart" size={17} />
          </div>
          <div className="metric-main">
            <strong className="num">{tech.rsi?.toFixed(1) ?? "—"}</strong>
            <span className="badge neutral">
              {tech.rsi === null
                ? "Unavailable"
                : tech.rsi > 70
                  ? "Overbought"
                  : tech.rsi < 30
                    ? "Oversold"
                    : "Balanced"}
            </span>
          </div>
          <div className="rsi-meter" aria-hidden="true">
            <span style={{ insetInlineStart: `${tech.rsi ?? 50}%` }} />
          </div>
          <p>RSI (14) · 5m candles</p>
        </div>
        <div className="panel metric-card">
          <div className="metric-label">
            Trading volume
            <Icon name="layers" size={17} />
          </div>
          <div className="metric-main">
            <strong className="num">
              {formatMoney(data.market?.volume ?? null, true)}
            </strong>
          </div>
          <div className="metric-bottom">
            <div>
              <span className="volume-label">24-hour volume</span>
              <p>Kraken spot · USD</p>
            </div>
            <div className="volume-bars" aria-hidden="true">
              {data.market?.candles.slice(-16).map((c, i, arr) => (
                <i
                  key={i}
                  style={{
                    height: `${8 + (c.volume / Math.max(...arr.map((v) => v.volume), 1)) * 28}px`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
      <div className="analysis-grid">
        <Chart data={data} settings={settings} />
        <section
          className="panel insight-panel"
          aria-labelledby="insight-heading"
        >
          <div className="panel-heading">
            <h2 id="insight-heading">The market read</h2>
            <span className="insight-icon">
              <Icon name="activity" size={18} />
            </span>
          </div>
          <div className="insight-label">
            {data.mode === "demo"
              ? "Illustrative signal summary"
              : "Rule-based signal summary"}
          </div>
          <div className={`insight-bias ${toneClass}`}>
            <span className="bias-icon">
              <Icon
                name={bullishFactors >= 2 ? "trend" : "activity"}
                size={26}
              />
            </span>
            <p className="bias-value">{bias}</p>
          </div>
          <p className="insight-copy">
            {staleSocial
              ? "The conversation sample is more than a day old. Use the price indicators for current context, or analyze your own fresh headlines below."
              : !complete
                ? "A useful perspective needs both market prices and a conversation sample. Retry the analysis or use demo mode."
                : bullishFactors >= 2
                  ? "Positive signals are building. Keep an eye on momentum and wait for your own confirmation."
                  : "The signals are not aligned. Watch how price develops before drawing a conclusion."}
          </p>
          <div className="alignment">
            <span>Positive signal alignment</span>
            <strong>
              {bullishFactors}
              <span> / 3</span>
            </strong>
          </div>
          <div className="alignment-bars" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className={i < bullishFactors ? "filled" : ""} />
            ))}
          </div>
          <ul className="factor-list">
            <li>
              <span
                className={`factor-icon ${!staleSocial && stats.score !== null && stats.score >= settings.threshold ? "yes" : ""}`}
              >
                <Icon
                  name={
                    !staleSocial &&
                    stats.score !== null &&
                    stats.score >= settings.threshold
                      ? "check"
                      : "info"
                  }
                  size={13}
                />
              </span>
              {staleSocial
                ? "Conversation sample is over 24 hours old"
                : stats.score === null
                  ? "Conversation sample unavailable"
                  : `${tone(stats.score, settings.threshold)} conversation tone`}
            </li>
            <li>
              <span
                className={`factor-icon ${data.market && tech.vwap !== null && data.market.price > tech.vwap ? "yes" : ""}`}
              >
                <Icon
                  name={
                    data.market &&
                    tech.vwap !== null &&
                    data.market.price > tech.vwap
                      ? "check"
                      : "info"
                  }
                  size={13}
                />
              </span>
              {!data.market || tech.vwap === null
                ? "Session VWAP unavailable"
                : `Price ${data.market.price > tech.vwap ? "above" : "below"} session VWAP`}
            </li>
            <li>
              <span
                className={`factor-icon ${tech.rsi !== null && tech.rsi >= 50 && tech.rsi < 70 ? "yes" : ""}`}
              >
                <Icon
                  name={
                    tech.rsi !== null && tech.rsi >= 50 && tech.rsi < 70
                      ? "check"
                      : "info"
                  }
                  size={13}
                />
              </span>
              {tech.rsi === null
                ? "RSI unavailable"
                : tech.rsi >= 70
                  ? "RSI is overbought"
                  : tech.rsi < 30
                    ? "RSI is oversold"
                    : tech.rsi >= 50
                      ? "RSI supports positive momentum"
                      : "RSI momentum is below 50"}
            </li>
          </ul>
          <button
            className="button secondary levels-button"
            onClick={() => setLevels(!levels)}
            aria-expanded={levels}
          >
            Explore price levels
            <Icon name="chevron" size={15} className={levels ? "rotate" : ""} />
          </button>
          {levels && (
            <div className="price-levels">
              {data.market && tech.atr !== null ? (
                <>
                  <p>Illustrative long scenario</p>
                  <dl>
                    <div>
                      <dt>Reference price</dt>
                      <dd>{formatMoney(data.market.price)}</dd>
                    </div>
                    <div>
                      <dt>Stop · −1.5 ATR</dt>
                      <dd>{formatMoney(data.market.price - tech.atr * 1.5)}</dd>
                    </div>
                    <div>
                      <dt>Target · +3 ATR</dt>
                      <dd>{formatMoney(data.market.price + tech.atr * 3)}</dd>
                    </div>
                    <div>
                      <dt>Reward / risk</dt>
                      <dd>2:1 before costs</dd>
                    </div>
                  </dl>
                  <small>
                    Calculated reference levels, not an order or a trade
                    recommendation. Fees and slippage are excluded.
                  </small>
                </>
              ) : (
                <p>
                  Price levels need at least 15 completed candles. Retry the
                  market analysis.
                </p>
              )}
            </div>
          )}
          <p className="insight-footnote">
            A research aid, not a trade recommendation.
          </p>
        </section>
      </div>
      <section
        className="panel indicator-strip"
        aria-label="Trading indicators"
      >
        <div>
          <span>
            Session VWAP <span className="indicator-note">UTC</span>
          </span>
          <strong className="num">{formatMoney(tech.vwap)}</strong>
        </div>
        <div>
          <span>
            Moving average <span className="indicator-note">20</span>
          </span>
          <strong className="num">{formatMoney(tech.sma)}</strong>
        </div>
        <div>
          <span>
            Funding rate <span className="indicator-note">last</span>
          </span>
          <strong className="num">
            {data.derivatives
              ? `${data.derivatives.funding >= 0 ? "+" : ""}${data.derivatives.funding.toFixed(4)}%`
              : "—"}
          </strong>
        </div>
        <div>
          <span>
            Open interest <span className="indicator-note">{symbol}</span>
          </span>
          <strong className="num">
            {data.derivatives
              ? new Intl.NumberFormat("en-US", {
                  maximumFractionDigits: 0,
                }).format(data.derivatives.openInterest)
              : "—"}
          </strong>
        </div>
        <a
          href="#guide"
          className="indicator-guide"
          aria-label="Read the indicator guide"
        >
          <Icon name="info" size={19} />
        </a>
      </section>
      <div className="conversation-grid">
        <section
          className="panel conversation-panel"
          aria-labelledby="conversation-heading"
        >
          <div className="panel-heading">
            <div>
              <h2 id="conversation-heading">
                Market conversation
                <span className="count-badge">{data.stories.length}</span>
              </h2>
              <p>
                {data.mode === "demo"
                  ? "Example headlines · illustrative content"
                  : "Hacker News headlines · last 7 days"}
              </p>
            </div>
            <button
              className="text-button analyzer-toggle"
              onClick={() => setFeedMode(feedMode === "feed" ? "text" : "feed")}
              aria-expanded={feedMode === "text"}
            >
              {feedMode === "feed" ? "Analyze text" : "Back to feed"}
              <Icon name={feedMode === "feed" ? "plus" : "arrow"} size={15} />
            </button>
          </div>
          {feedMode === "text" ? (
            <TextAnalyzer threshold={settings.threshold} />
          ) : (
            <>
              <div
                className="feed-filters"
                aria-label="Filter conversation by sentiment"
              >
                {(["All", "Bullish", "Neutral", "Bearish"] as const).map(
                  (f) => (
                    <button
                      key={f}
                      aria-pressed={filter === f}
                      onClick={() => {
                        setFilter(f);
                        setShowAll(false);
                      }}
                    >
                      {f}
                      {f === "All" && <span>{data.stories.length}</span>}
                    </button>
                  ),
                )}
              </div>
              <div role="status" className="sr-only">
                {filtered.length} {filter === "All" ? "" : filter.toLowerCase()}{" "}
                headlines
              </div>
              <ul className="story-list">
                {visible.map((story) => (
                  <li key={story.id}>
                    <span
                      className={`story-icon ${tone(story.score, settings.threshold).toLowerCase()}`}
                    >
                      <Icon
                        name={
                          tone(story.score, settings.threshold) === "Bullish"
                            ? "trend"
                            : "chart"
                        }
                        size={17}
                      />
                    </span>
                    <div className="story-content">
                      <div className="story-title">
                        {story.url ? (
                          <a href={story.url} target="_blank" rel="noreferrer">
                            {story.title}
                            <Icon name="external" size={12} />
                          </a>
                        ) : (
                          <p>{story.title}</p>
                        )}
                      </div>
                      <div className="story-meta">
                        <span>
                          {data.mode === "demo" ? "Example" : "Hacker News"}
                        </span>
                        <span className="meta-dot">·</span>
                        <time dateTime={new Date(story.time).toISOString()}>
                          {new Intl.DateTimeFormat("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            ...(settings.timezone === "UTC"
                              ? { timeZone: "UTC" }
                              : {}),
                          }).format(story.time)}
                        </time>
                        {data.mode === "live" && (
                          <span>· {story.comments} comments</span>
                        )}
                      </div>
                    </div>
                    <SentimentBadge
                      score={story.score}
                      threshold={settings.threshold}
                    />
                  </li>
                ))}
              </ul>
              {!visible.length && (
                <div className="feed-empty">
                  <Icon name="search" size={26} />
                  <h3>
                    {data.stories.length
                      ? `No ${filter.toLowerCase()} headlines in this sample`
                      : "No headlines in this sample"}
                  </h3>
                  <p>
                    {data.stories.length
                      ? "Try another sentiment filter to see the conversation."
                      : "Try another market or analyze your own headlines."}
                  </p>
                  <button
                    className="button secondary"
                    onClick={() =>
                      data.stories.length
                        ? setFilter("All")
                        : setFeedMode("text")
                    }
                  >
                    {data.stories.length ? "Clear filter" : "Analyze text"}
                  </button>
                </div>
              )}
              {filtered.length > 4 && (
                <button
                  className="feed-more"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll
                    ? "Show fewer headlines"
                    : `View all ${filtered.length} headlines`}
                  <Icon name="arrow" size={16} />
                </button>
              )}
            </>
          )}
        </section>
        <section className="panel breakdown-panel">
          <div className="panel-heading">
            <h2>Sentiment breakdown</h2>
            <Icon name="chart" size={18} />
          </div>
          <p className="breakdown-intro">The tone behind the conversation.</p>
          <div className="distribution-bar" aria-hidden="true">
            {(["Bullish", "Neutral", "Bearish"] as Tone[]).map((t) => (
              <span
                className={t.toLowerCase()}
                key={t}
                style={{
                  width: `${data.stories.length ? (stats.counts[t] / data.stories.length) * 100 : 0}%`,
                }}
              />
            ))}
          </div>
          <div className="distribution-list">
            {(["Bullish", "Neutral", "Bearish"] as Tone[]).map((t) => (
              <div key={t}>
                <span>
                  <i className={`legend-dot ${t.toLowerCase()}`} />
                  {t}
                </span>
                <span className="distribution-count">
                  {stats.counts[t]}
                  <strong className="num">
                    {data.stories.length
                      ? Math.round(
                          (stats.counts[t] / data.stories.length) * 100,
                        )
                      : 0}
                    %
                  </strong>
                </span>
              </div>
            ))}
          </div>
          <div className="sample-note">
            <Icon name="info" size={17} />
            <div>
              <strong>Context matters.</strong>
              <p>
                {stats.classified} of {data.stories.length} headlines contain
                recognized sentiment words.{" "}
                {data.mode === "demo"
                  ? "This sample is illustrative."
                  : "This technology-focused sample may not reflect the wider market."}
              </p>
              <a href="#guide">
                How sentiment is calculated <Icon name="arrow" size={13} />
              </a>
            </div>
          </div>
        </section>
      </div>
      <details className="source-details">
        <summary>Data sources & freshness</summary>
        <div className="source-status-grid">
          <div>
            <strong>Spot market · Kraken</strong>
            <span>
              {data.marketState === "demo"
                ? "Illustrative demo data"
                : data.marketState === "live" && data.market
                  ? `Latest candle: ${new Date(data.market.candles.at(-1)!.time).toISOString().replace("T", " ").slice(0, 16)} UTC`
                  : "Unavailable — retry Analyze market"}
            </span>
          </div>
          <div>
            <strong>Conversation · Hacker News / Algolia</strong>
            <span>
              {data.socialState === "demo"
                ? "Fictional sample headlines"
                : data.socialState === "live"
                  ? `${data.stories.length} headlines from the last 7 days${newestStoryTime ? ` · newest: ${new Date(newestStoryTime).toISOString().replace("T", " ").slice(0, 16)} UTC` : ""}`
                  : "Unavailable — retry or analyze your own text"}
            </span>
          </div>
          <div>
            <strong>Perpetual futures · Binance USDT</strong>
            <span>
              {data.derivativesState === "demo"
                ? "Illustrative demo data"
                : data.derivativesState === "live" && data.derivatives
                  ? `Source time: ${new Date(data.derivatives.time).toISOString().replace("T", " ").slice(0, 16)} UTC`
                  : "Unavailable — public access can vary by region"}
            </span>
          </div>
        </div>
      </details>
      <div className="dashboard-footer">
        <span>
          <Icon name="shield" size={14} /> Your workspace. Your perspective.
        </span>
        <span>Research support only · Always verify before trading.</span>
      </div>
    </>
  );
}
