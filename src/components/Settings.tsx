import { useState } from "react";
import { ASSETS, DEFAULT_SETTINGS } from "../types";
import type { Settings as SettingsType } from "../types";
import Icon from "./Icon";
export default function Settings({
  settings,
  onSave,
}: {
  settings: SettingsType;
  onSave: (value: SettingsType) => boolean;
}) {
  const [draft, setDraft] = useState(settings);
  const [message, setMessage] = useState("");
  const change = <K extends keyof SettingsType>(
    key: K,
    value: SettingsType[K],
  ) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setMessage("");
  };
  return (
    <div className="settings-page">
      <div className="page-heading">
        <div>
          <h1>Customize your workspace</h1>
          <p>Set your market, refresh interval, and sentiment threshold.</p>
        </div>
        <span className="badge neutral">
          <Icon name="shield" size={14} /> Saved on this device
        </span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const stored = onSave(draft);
          setMessage(
            stored
              ? "Settings saved. Your workspace is up to date."
              : "Settings applied for this session. Browser storage is unavailable.",
          );
        }}
      >
        <section className="panel settings-panel">
          <div className="settings-section-heading">
            <span className="settings-icon">
              <Icon name="home" />
            </span>
            <div>
              <h2>Your workspace</h2>
              <p>Start with the market that matters to you.</p>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <label htmlFor="default-asset">Default market</label>
              <p>Selected when you next open Pulse.</p>
            </div>
            <select
              id="default-asset"
              value={draft.defaultAsset}
              onChange={(e) =>
                change(
                  "defaultAsset",
                  e.target.value as SettingsType["defaultAsset"],
                )
              }
            >
              {ASSETS.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.name} ({a.symbol})
                </option>
              ))}
            </select>
          </div>
          <div className="setting-row">
            <div>
              <label htmlFor="timezone">Chart time zone</label>
              <p>Applies to chart labels and update times.</p>
            </div>
            <select
              id="timezone"
              value={draft.timezone}
              onChange={(e) =>
                change("timezone", e.target.value as "local" | "UTC")
              }
            >
              <option value="local">Local time</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          <fieldset className="setting-row watchlist-setting">
            <legend>Watchlist</legend>
            <p>Keep your favorite markets within reach.</p>
            <div className="watchlist-options">
              {ASSETS.map((a) => (
                <label
                  key={a.symbol}
                  className={
                    draft.watchlist.includes(a.symbol) ? "selected" : ""
                  }
                >
                  <input
                    type="checkbox"
                    checked={draft.watchlist.includes(a.symbol)}
                    onChange={(e) =>
                      change(
                        "watchlist",
                        e.target.checked
                          ? [...draft.watchlist, a.symbol]
                          : draft.watchlist.filter((s) => s !== a.symbol),
                      )
                    }
                  />
                  <span className={`coin small ${a.color}`}>{a.glyph}</span>
                  {a.symbol}
                </label>
              ))}
            </div>
          </fieldset>
        </section>
        <section className="panel settings-panel">
          <div className="settings-section-heading">
            <span className="settings-icon">
              <Icon name="refresh" />
            </span>
            <div>
              <h2>Data & analysis</h2>
              <p>Control when your market perspective updates.</p>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <label htmlFor="auto-refresh">
                Automatically refresh live data
              </label>
              <p>Only runs while the dashboard tab is visible.</p>
            </div>
            <label className="switch">
              <input
                id="auto-refresh"
                type="checkbox"
                checked={draft.autoRefresh}
                onChange={(e) => change("autoRefresh", e.target.checked)}
              />
              <span aria-hidden="true" />
            </label>
          </div>
          <div className="setting-row">
            <div>
              <label htmlFor="interval">Refresh interval</label>
              <p>Public APIs may limit frequent requests.</p>
            </div>
            <select
              id="interval"
              value={draft.interval}
              onChange={(e) => change("interval", Number(e.target.value))}
            >
              {[30, 60, 120, 300].map((n) => (
                <option value={n} key={n}>
                  {n < 60
                    ? `${n} seconds`
                    : `${n / 60} minute${n > 60 ? "s" : ""}`}
                </option>
              ))}
            </select>
          </div>
          <div className="setting-row">
            <div>
              <label htmlFor="sample-size">Conversation sample</label>
              <p>
                Maximum headlines from the last 7 days. Fewer may be available.
              </p>
            </div>
            <select
              id="sample-size"
              value={draft.sampleSize}
              onChange={(e) => change("sampleSize", Number(e.target.value))}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  Up to {n} headlines
                </option>
              ))}
            </select>
          </div>
          <div className="setting-row">
            <div>
              <label htmlFor="threshold">Sentiment threshold</label>
              <p>
                Bullish ≥ {draft.threshold}. Bearish ≤ {100 - draft.threshold}.
                Between these is neutral.
              </p>
            </div>
            <select
              id="threshold"
              value={draft.threshold}
              onChange={(e) => change("threshold", Number(e.target.value))}
            >
              {[55, 60, 65, 70].map((n) => (
                <option key={n} value={n}>
                  {n} / 100{n === 60 ? " (default)" : ""}
                </option>
              ))}
            </select>
          </div>
        </section>
        <div className="settings-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setDraft({ ...DEFAULT_SETTINGS });
              setMessage(
                "Defaults restored in the form. Save settings to apply.",
              );
            }}
          >
            Restore defaults
          </button>
          <button type="submit" className="button primary">
            <Icon name="check" size={18} />
            Save settings
          </button>
        </div>
        <p role="status" className="save-status">
          {message}
        </p>
      </form>
      <p className="settings-footnote">
        <Icon name="shield" size={16} /> Settings stay in this browser. Clearing
        browser storage resets your preferences.
      </p>
    </div>
  );
}
