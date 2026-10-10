import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatMoney, formatTime } from "../analysis";
import type { DataSet, Period, Settings } from "../types";
import Icon from "./Icon";

export function Sparkline({
  values,
  className = "",
  width = 100,
  height = 35,
}: {
  values: number[];
  className?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values),
    max = Math.max(...values);
  const d = values
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${(i / (values.length - 1)) * width},${height - 3 - ((v - min) / (max - min || 1)) * (height - 6)}`,
    )
    .join(" ");
  return (
    <svg
      aria-hidden="true"
      className={`sparkline ${className}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Chart({
  data,
  settings,
}: {
  data: DataSet;
  settings: Settings;
}) {
  const container = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(716);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(250, entries[0].contentRect.width)),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const [metric, setMetric] = useState<"price" | "sentiment">("price");
  const [period, setPeriod] = useState<Period>("1D");
  const [active, setActive] = useState<number | null>(null);
  const [inspect, setInspect] = useState(false);
  const id = useId().replaceAll(":", "");
  const hours = { "1H": 1, "4H": 4, "1D": 24 }[period];
  const points = useMemo(() => {
    const now = data.mode === "demo" ? data.updatedAt : Date.now();
    const since = now - hours * 3600000;
    if (metric === "price")
      return (
        data.market?.candles
          .filter((c) => c.time >= since && c.time <= now)
          .map((c) => ({ time: c.time, value: c.close })) ?? []
      );
    // Each point is one observed headline, in time order. No interpolated observations.
    return data.stories
      .filter((s) => s.time >= since && s.time <= now)
      .sort((a, b) => a.time - b.time)
      .map((s) => ({ time: s.time, value: s.score }));
  }, [data, hours, metric]);
  const values = points.map((p) => p.value);
  const min = metric === "sentiment" ? 0 : Math.min(...values) * 0.9985;
  const max = metric === "sentiment" ? 100 : Math.max(...values) * 1.0015;
  const left = 8,
    right = width - 65,
    top = 18,
    bottom = 213;
  // The window filters observations; the axis spans the first/last observation.
  // A shared timestamp gets a centered one-minute domain, never index spacing.
  const firstTime = points[0]?.time ?? 0;
  const lastTime = points.at(-1)?.time ?? firstTime;
  const timeStart = firstTime === lastTime ? firstTime - 30000 : firstTime;
  const timeEnd = firstTime === lastTime ? lastTime + 30000 : lastTime;
  const timeSpan = timeEnd - timeStart;
  const x = (i: number) =>
    left + ((points[i].time - timeStart) / timeSpan) * (right - left);
  const tickTime = (time: number) =>
    timeSpan < 240000
      ? new Intl.DateTimeFormat("en-US", {
          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
          ...(settings.timezone === "UTC" ? { timeZone: "UTC" } : {}),
        }).format(time)
      : formatTime(time, settings.timezone);
  const y = (v: number) =>
    bottom - ((v - min) / (max - min || 1)) * (bottom - top);
  const line = points
    .map(
      (p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`,
    )
    .join(" ");
  const index =
    active === null ? points.length - 1 : Math.min(active, points.length - 1);
  const current = points[index];
  const displayValue = (v: number) =>
    metric === "price" ? formatMoney(v) : `${Math.round(v)} / 100`;
  const change =
    points.length > 1 ? (points.at(-1)!.value / points[0].value - 1) * 100 : 0;
  const chooseMetric = (value: "price" | "sentiment") => {
    setMetric(value);
    setActive(null);
  };
  return (
    <section
      ref={container}
      className="panel chart-panel"
      aria-labelledby="chart-heading"
    >
      <div className="panel-heading">
        <div>
          <h2 id="chart-heading">Market pulse</h2>
          <p>
            {metric === "price"
              ? `${data.symbol} / USD · 5-minute candles`
              : "Headline sentiment · individual observations"}
          </p>
        </div>
        <div className="segmented metric-toggle" aria-label="Chart metric">
          <button
            aria-pressed={metric === "price"}
            onClick={() => chooseMetric("price")}
          >
            Price
          </button>
          <button
            aria-pressed={metric === "sentiment"}
            onClick={() => chooseMetric("sentiment")}
          >
            Sentiment
          </button>
        </div>
      </div>
      <div className="chart-toolbar">
        <div className="chart-current">
          <span className="chart-value num">
            {current ? displayValue(current.value) : "No observations"}
          </span>
          {metric === "price" && points.length > 1 && (
            <span className={`change ${change >= 0 ? "positive" : "negative"}`}>
              {change >= 0 ? "↗" : "↘"} {Math.abs(change).toFixed(2)}%{" "}
              <span className="subtle">this period</span>
            </span>
          )}
        </div>
        <div className="period-toggle" aria-label="Chart period">
          {(["1H", "4H", "1D"] as Period[]).map((p) => (
            <button
              key={p}
              aria-label={`Show ${p === "1D" ? "24 hours" : p === "4H" ? "4 hours" : "1 hour"}`}
              aria-pressed={period === p}
              onClick={() => {
                setPeriod(p);
                setActive(null);
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      {points.length > 1 ? (
        <div className="chart-wrap">
          <svg
            className="main-chart"
            viewBox={`0 0 ${width} 253`}
            role="img"
            aria-label={`${metric === "price" ? "Price" : "Sentiment"} chart for ${data.symbol}, ${period}. From ${displayValue(points[0].value)} to ${displayValue(points.at(-1)!.value)}. Data table below.`}
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const fraction = ((((event.clientX - bounds.left) / bounds.width) * width) - left) / (right - left);
              const time = timeStart + Math.max(0, Math.min(1, fraction)) * timeSpan;
              // Ties (including duplicate timestamps) select the earlier item.
              setActive(points.reduce((nearest, point, i) =>
                Math.abs(point.time - time) < Math.abs(points[nearest].time - time) ? i : nearest, 0));
            }}
            onPointerLeave={() => {
              if (!inspect) setActive(null);
            }}
          >
            <defs>
              <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-chart)"
                  stopOpacity=".17"
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-chart)"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3, 4].map((i) => {
              const v = min + ((max - min) * i) / 4;
              return (
                <g key={i}>
                  <line
                    x1={left}
                    y1={y(v)}
                    x2={right}
                    y2={y(v)}
                    stroke="var(--color-border)"
                    strokeDasharray="3 5"
                  />
                  <text x={width - 53} y={y(v) + 4} className="chart-label">
                    {metric === "price"
                      ? new Intl.NumberFormat("en-US", {
                          maximumFractionDigits: data.symbol === "BTC" ? 0 : 2,
                        }).format(v)
                      : Math.round(v)}
                  </text>
                </g>
              );
            })}
            <path
              d={`${line} L${x(points.length - 1)},${bottom} L${x(0)},${bottom}Z`}
              fill={`url(#fill-${id})`}
            />
            <path
              d={line}
              fill="none"
              stroke="var(--color-chart)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {current && (
              <>
                <line
                  x1={x(index)}
                  x2={x(index)}
                  y1={top}
                  y2={bottom}
                  stroke="var(--color-chart)"
                  opacity=".35"
                  strokeDasharray="4 4"
                />
                <circle
                  cx={x(index)}
                  cy={y(current.value)}
                  r="5"
                  fill="var(--color-chart)"
                  stroke="var(--color-surface)"
                  strokeWidth="3"
                />
              </>
            )}
            {(timeSpan < 240000 && width < 450 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).map((fraction, i) => (
              <text
                key={i}
                x={left + fraction * (right - left)}
                y="243"
                textAnchor={fraction === 0 ? "start" : fraction === 1 ? "end" : "middle"}
                className="chart-label"
              >
                {tickTime(timeStart + fraction * timeSpan)}
              </text>
            ))}
          </svg>
          <div className="chart-caption">
            <span>
              <span className="legend-dot" />
              {metric === "price" ? "Market price" : "Headline score"}
            </span>
            <span>
              {current && formatTime(current.time, settings.timezone)} ·{" "}
              {settings.timezone === "UTC" ? "UTC" : "Local time"}
            </span>
            <button
              className="text-button"
              onClick={() => {
                setInspect(!inspect);
                setActive(points.length - 1);
              }}
              aria-expanded={inspect}
            >
              {inspect ? "Close inspector" : "Inspect data"}
              <Icon name="search" size={14} />
            </button>
          </div>
          {inspect && (
            <div className="chart-inspector">
              <label htmlFor={`inspect-${id}`}>
                Observation {index + 1} of {points.length}:{" "}
                {current &&
                  `${formatTime(current.time, settings.timezone)} · ${displayValue(current.value)}`}
              </label>
              <input
                id={`inspect-${id}`}
                type="range"
                min="0"
                max={points.length - 1}
                value={index}
                onChange={(e) => setActive(Number(e.target.value))}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="chart-empty">
          <Icon name="chart" size={32} />
          <h3>Not enough data in this period</h3>
          <p>
            {metric === "sentiment"
              ? "Try a longer period or analyze your own headlines."
              : "Select Analyze market to fetch the latest candles."}
          </p>
        </div>
      )}
      <details className="data-details">
        <summary>
          View chart data <span>({points.length} observations)</span>
        </summary>
        <div className="table-scroll">
          <table>
            <caption>
              Latest 20 observations ·{" "}
              {settings.timezone === "UTC" ? "UTC" : "local time"}
            </caption>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">
                  {metric === "price" ? "Price (USD)" : "Sentiment score"}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.slice(-20).map((p, i) => (
                <tr key={i}>
                  <td>
                    {new Date(p.time).toLocaleDateString(
                      "en-US",
                      settings.timezone === "UTC" ? { timeZone: "UTC" } : {},
                    )}{" "}
                    {formatTime(p.time, settings.timezone)}
                  </td>
                  <td className="num">{displayValue(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
