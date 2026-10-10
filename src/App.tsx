import { useCallback, useEffect, useRef, useState } from "react";
import { demoData, fetchLive, loadSettings } from "./data";
import { ASSETS } from "./types";
import type { DataSet, Settings as SettingsType, Symbol } from "./types";
import Dashboard from "./components/Dashboard";
import Guide from "./components/Guide";
import Settings from "./components/Settings";
import Icon from "./components/Icon";

function route() {
  return location.hash === "#settings"
    ? "settings"
    : location.hash === "#guide"
      ? "guide"
      : "home";
}
export default function App() {
  const [settings, setSettings] = useState<SettingsType>(loadSettings);
  const [page, setPage] = useState(route);
  const [symbol, setSymbol] = useState<Symbol>(settings.defaultAsset);
  const [data, setData] = useState<DataSet>(() =>
    demoData(settings.defaultAsset),
  );
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [now, setNow] = useState(Date.now());
  const controller = useRef<AbortController | null>(null);
  const main = useRef<HTMLElement>(null);
  const announce = useCallback(
    (message: string) => setAnnouncement(message),
    [],
  );
  useEffect(() => {
    const changed = () => {
      setPage(route());
      window.scrollTo(0, 0);
      requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    document.title = `Pulse — ${page === "settings" ? "Settings" : page === "guide" ? "How to use" : "Market overview"}`;
  }, [page]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => () => controller.current?.abort(), []);
  const analyze = useCallback(
    async (asset: Symbol = symbol) => {
      controller.current?.abort();
      const requestController = new AbortController();
      controller.current = requestController;
      setBusy(true);
      setAnnouncement(`Analyzing ${asset} market and conversation data.`);
      try {
        const result = await fetchLive(
          asset,
          settings.sampleSize,
          requestController.signal,
        );
        if (requestController.signal.aborted) return;
        setData(result);
        setAnnouncement(
          result.errors.length
            ? `${asset} analysis finished with ${result.errors.length} unavailable source${result.errors.length === 1 ? "" : "s"}. See the data notice.`
            : `${asset} analysis updated. ${result.stories.length} headlines analyzed.`,
        );
      } catch (error) {
        if (!requestController.signal.aborted)
          setAnnouncement(
            `Unable to finish analysis. ${error instanceof Error ? error.message : "Please try again."}`,
          );
      } finally {
        if (controller.current === requestController) setBusy(false);
      }
    },
    [symbol, settings.sampleSize],
  );
  useEffect(() => {
    if (
      data.mode !== "live" ||
      paused ||
      !settings.autoRefresh ||
      page !== "home"
    )
      return;
    const timer = setInterval(() => {
      if (!document.hidden && !controller.current?.signal.aborted && !busy)
        void analyze();
    }, settings.interval * 1000);
    return () => clearInterval(timer);
  }, [
    data.mode,
    paused,
    settings.autoRefresh,
    settings.interval,
    page,
    analyze,
    busy,
  ]);
  const changeSymbol = (next: Symbol) => {
    controller.current?.abort();
    setBusy(false);
    setSymbol(next);
    if (data.mode === "live") {
      setData({
        symbol: next,
        mode: "live",
        market: null,
        stories: [],
        derivatives: null,
        marketState: "unavailable",
        socialState: "unavailable",
        derivativesState: "unavailable",
        updatedAt: Date.now(),
        errors: [],
      });
      void analyze(next);
    } else setData(demoData(next));
    setAnnouncement(`${ASSETS.find((a) => a.symbol === next)!.name} selected.`);
  };
  const saveSettings = (value: SettingsType) => {
    setSettings(value);
    try {
      localStorage.setItem("pulse-settings", JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };
  const today = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(settings.timezone === "UTC" ? { timeZone: "UTC" } : {}),
  }).format(now);
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <a href="#home" className="brand" aria-label="Pulse home">
          <span className="brand-mark">
            <Icon name="activity" size={24} />
          </span>
          <span>
            pulse<span className="brand-period">.</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="workspace-icon">P</span>
          <div>
            Personal workspace<small>Built around your perspective</small>
          </div>
        </div>
        <nav className="primary-nav" aria-label="Main navigation">
          <a href="#home" aria-current={page === "home" ? "page" : undefined}>
            <Icon name="home" />
            Home
          </a>
          <a href="#guide" aria-current={page === "guide" ? "page" : undefined}>
            <Icon name="guide" />
            How to use
          </a>
          <a
            href="#settings"
            aria-current={page === "settings" ? "page" : undefined}
          >
            <Icon name="settings" />
            Settings
          </a>
        </nav>
        <div className="sidebar-watchlist">
          <div className="watchlist-title">
            <span>Watchlist</span>
            <a href="#settings" aria-label="Customize watchlist">
              <Icon name="plus" size={16} />
            </a>
          </div>
          {settings.watchlist.length ? (
            settings.watchlist.map((s) => {
              const a = ASSETS.find((a) => a.symbol === s)!;
              return (
                <button
                  key={s}
                  className={symbol === s ? "selected" : ""}
                  onClick={() => {
                    changeSymbol(s);
                    if (page !== "home") location.hash = "home";
                  }}
                  aria-pressed={symbol === s}
                >
                  <span className={`coin small ${a.color}`}>{a.glyph}</span>
                  <span>
                    {a.name}
                    <small>{a.symbol}</small>
                  </span>
                  <Icon name={symbol === s ? "check" : "chevron"} size={14} />
                </button>
              );
            })
          ) : (
            <p className="watchlist-empty">
              Add a market in <a href="#settings">Settings</a>.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon">
              <Icon name="layers" size={22} />
            </span>
            <h2>A little less noise.</h2>
            <p>Get to know the signals behind your dashboard.</p>
            <a href="#guide">
              Explore the guide
              <Icon name="arrow" size={15} />
            </a>
          </div>
          <div className="local-profile">
            <span className="avatar">P</span>
            <div>
              Personal workspace<small>Local to this device</small>
            </div>
            <Icon name="shield" size={16} />
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="breadcrumb">
            <Icon
              name={
                page === "home"
                  ? "home"
                  : page === "guide"
                    ? "guide"
                    : "settings"
              }
              size={17}
            />
            <span>Workspace</span>
            <Icon name="chevron" size={12} />
            <strong>
              {page === "home"
                ? "Overview"
                : page === "guide"
                  ? "How to use"
                  : "Settings"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="market-hours">
              <span className="status-dot" />
              Crypto markets · 24/7
            </span>
            <span className="topbar-divider" />
            <time>{today}</time>
            <span className="header-avatar">P</span>
          </div>
        </header>
        <main
          id="main-content"
          aria-busy={busy && page === "home"}
          className="main-content"
          tabIndex={-1}
          ref={main}
        >
          {page === "home" ? (
            <Dashboard
              key={symbol}
              data={data}
              settings={settings}
              symbol={symbol}
              busy={busy}
              paused={paused}
              onSymbol={changeSymbol}
              onAnalyze={() => void analyze()}
              onPause={() => {
                if (!settings.autoRefresh) {
                  saveSettings({ ...settings, autoRefresh: true });
                  setPaused(false);
                } else setPaused((p) => !p);
              }}
              onDemo={() => {
                controller.current?.abort();
                setBusy(false);
                setData(demoData(symbol));
                setAnnouncement(
                  "Demo mode enabled. All figures are illustrative.",
                );
              }}
              announce={announce}
            />
          ) : page === "guide" ? (
            <Guide />
          ) : (
            <Settings settings={settings} onSave={saveSettings} />
          )}
        </main>
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
