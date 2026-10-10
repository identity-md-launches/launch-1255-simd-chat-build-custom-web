# Pulse — personal market perspective

A static, single-user crypto research app inspired by [Jev X Sentiment Analysis](https://github.com/brainstormity/Jev-X-Sentiment-Analysis). Built with React, TypeScript, and Vite. The ready-to-host production site is included in **`dist/`**, alongside source and `package-lock.json`.

![Pulse dashboard](artifacts/home-desktop.png)

## Use the app

1. Start with the labeled demo workspace, or select **Analyze market** to load public data.
2. Choose Bitcoin, Ethereum, Solana, or Chainlink. Compare sentiment, price, RSI, volume, VWAP, moving average, funding, and open interest.
3. Change chart metric/window, inspect an observation, filter headlines, or review the rule-based action, confidence, and ATR entry range. Optional position context enables Take Profit checks for an existing long or short. Export a CSV to save the current analysis and provenance.
4. Use **Analyze text** to score up to 1,000 pasted headlines/posts locally, one per line. This is useful when the public conversation sample is sparse or old.
5. Read **How to use** for methodology. **Settings** saves the default market, watchlist, refresh interval, sample size, time zone, and sentiment threshold in this browser.

The initial demo makes no API requests. Analyze market opts into public-source requests. Live mode polls at the saved interval (default 60 seconds), only on Home while the browser tab is visible. Pause/resume is available on desktop and mobile. It is public-API polling, not a tick-by-tick exchange feed; OHLC candles are 5 minutes.

## Install, develop, preview, rebuild

Use Node **22.12 or later** and npm. No keys, environment files, database, or application server are needed.

```sh
npm ci
npm run dev
```

The development command prints its local URL. For the production export:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`npm run build` runs TypeScript and writes `dist/`. `npm run preview` serves that directory; use the URL printed by Vite. The source’s public font URL is rewritten by Vite for the relative production base.

To preview an already exported copy without installing frontend tooling:

```sh
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. Use HTTP/HTTPS hosting, not a `file://` double-click, because the application uses JavaScript modules.

## Publish

Upload **the complete contents of `dist/`** to a static host, gateway directory, or ENS/IPFS site. The publisher should serve the included export; it does not need to rebuild. Keep `assets/`, `fonts/`, `favicon.svg`, and `social-card.png` beside `index.html` in their existing relative locations.

Vite uses `base: './'`. Routes are `#home`, `#guide`, and `#settings`, so no server-side SPA rewrite is required. The actual export was tested under `/preview/`, including direct hash navigation and local asset loading.

`index.html` contains a title, description, SVG favicon, `og:title`, `og:description`, and a local 1200×630 PNG `og:image`. The image URL is relative for portable subpath hosting. Some social crawlers require an absolute URL: after choosing the public deployment address, replace the source `og:image` with that deployment’s absolute image URL and rebuild if that host requires it. No public hostname has been invented.

Do not upload `node_modules`, package caches, test scratch output, or the development tools. Keep `dist/`, source, configuration, documentation, and the lockfile in the submission. The explicit `.gitignore` path budget is 512 bytes (see `artifacts/PATH-BUDGET.md`); it excludes generated dependencies, caches, and scratch output at every nesting level while retaining the required export.

## Data and method

| Data                                               | Source and behavior                                                                                                                                                                                                                           |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spot price, UTC-day change, 24h quote volume, OHLC | [Kraken public API](https://docs.kraken.com/api-reference/market-data/get-ohlc-data); USD pairs; completed 5-minute candles for indicators                                                                                                    |
| Conversation sentiment                             | [Hacker News via Algolia](https://hn.algolia.com/api); newest matching story titles within 7 days; 10/25/50/100 maximum sample; actual returned count always shown                                                                            |
| Funding and open interest                          | [Binance public USDT futures API](https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Mark-Price); latest reported funding percentage per funding period, not annualized; open interest in asset units |
| Pasted text                                        | Local keyword scoring, no upload and no persistence                                                                                                                                                                                           |
| Preferences                                        | This browser’s `localStorage`; graceful session-only behavior if unavailable                                                                                                                                                                  |

Each title starts at 50. Positive/negative keyword weights are summed, with simple negation in the previous three words, then mapped by `round(50 + 50 × tanh(sum / 2))`. The headline scores are equally averaged. Default bullish/bearish thresholds are 60/40. This is transparent deterministic analysis, **not an AI model or calibrated probability**.

Technical calculations are in `src/analysis.ts`: Wilder RSI(14), session VWAP from midnight UTC, SMA(20), and the mean true range of the last 14 completed candles.

The Market read decision is calculated locally in `src/decision.ts`:

- **Buy**: bullish sentiment from headlines less than 24 hours old, price above session VWAP, and RSI strictly between 50 and 70. **Sell**: bearish fresh sentiment, price below VWAP, and RSI strictly between 30 and 50. Sell describes a short setup. All three entry signals must agree; otherwise **Hold** means wait for an entry.
- **Take Profit**: supply a long/short position and positive average entry in the optional Position context disclosure. The current price must imply a profit before costs, with RSI ≥70 for a long or ≤30 for a short. Otherwise Hold means no profit-taking trigger, not that the position is safe. Context is local, unsaved, and clears on market, data-mode, or page changes. No account or order execution is connected.
- **Confidence** is an uncalibrated assessment of rule support and sample coverage, not a probability of profit. Hold is Low. For an action whose conditions are met, fewer than 5 fresh titles or under 50% keyword coverage is Low; with at least 5 titles, 50–79% coverage is Moderate and ≥80% is High. Coverage means the fraction of titles with recognized sentiment words. HN remains a limited sample even at High.
- **Entry range**: latest price ±0.25 ATR. Long stop/target: midpoint −1.5 ATR / +3 ATR; short stop/target: midpoint +1.5 ATR / −3 ATR. Reward/risk is 2:1 at the midpoint, before costs, and changes with the actual fill. Hold, Take Profit, or unavailable decisions do not invent a new entry range.
- **Unavailable**: missing prices/headlines/indicators, price fetch ≥10 minutes old, last completed candle ≥15 minutes old, no headlines less than 24 hours old, invalid position entry, or invalid/non-positive price levels. Paused live decisions age out; labeled demo data uses its own snapshot time. All decision fields and supplied position context are included in CSV exports.

The decision's fresh sample can differ from the seven-day sentiment summary. Funding and open interest remain contextual indicators, not inputs to these rules. Fees, slippage, leverage, account risk, and position sizing are not modeled; recommendations are research rules, not personalized advice.

The reference project’s paid X ingestion, TypeSafe model, arbitrary-asset coverage, engagement/author-diversity analysis, squeeze probability, and calibrated AI confidence are **not reproduced**. The decision card is implemented using the documented local rules above. This browser-only adaptation uses four supported markets and public/local inputs. It does not pretend the HN sample is X sentiment or a representative cross-section of traders.

## Validation

Actual worker checks on **2026-10-10**, Node 22.22.2 / npm 10.9.7:

| Check                      | Result                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`        | Passed, zero TypeScript errors                                                                                                                        |
| `npm test`                 | 22 calculation/parsing/storage/CSV/decision tests passed                                                                                                       |
| `npm run build`            | Passed; complete relative-URL static export in `dist/`                                                                                                |
| `npm run validate:browser` | 24 production interaction checks passed; 9 axe scans found zero violations; details in `artifacts/validation.md` and `artifacts/browser-results.json` |
| Provider availability      | This revision validates deterministic intercepted responses; production provider availability is not asserted by those tests. |
| Better Interface review    | All six domains reviewed; findings fixed and limitations recorded in `artifacts/validation.md`                                                        |

To repeat the browser checks:

```sh
npx playwright install chromium
npm run build
npm run validate:browser
```

The script starts its own temporary static server under `/preview/`, tests the actual export, and closes both server and browser. Reports go to `test/scratch/validation/`; `PULSE_REPORT_DIR` can select another output location. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing Chromium executable. API success/failure/empty/stale/refresh/decision tests use deterministic intercepted responses. The browser context uses UTC for repeatable time-axis assertions; local-time formatting remains available in Settings. These tests do not certify current provider availability.

For this revision, the worker installed from this package/lockfile in `/tmp/pulse-revision`, copied the exact source/configuration there, ran the scripts, and copied the clean export back. Chromium and npm caches also stayed under `/tmp`. The assigned browser tool failed to initialize against a read-only cache path; the bounded Playwright script supplied the rendered checks instead. The delivered scripts work with a normal `npm ci` installation. Reproduction evidence and a response to every finding are in `artifacts/reproduction.json` and `.imd-responses.json`.

## Limitations

- Public services can fail, rate-limit, change CORS policy, or block a region. Requests time out after 12 seconds. Sources fail independently; failed fields become unavailable, with retry and demo recovery. No proxy is required or bundled.
- HN is technology-focused and often sparse. The app displays headline age and withholds the decision when no headlines less than 24 hours old remain. Fresh pasted text can be scored separately. Sarcasm, complex context, bots, and authorship quality are not modeled.
- Spot and perpetual data come from different exchanges and quote markets. Funding period lengths may vary. The source drawer identifies providers and timestamps; data is not a whole-market aggregate.
- There is no service worker: a previously loaded page supports demo/local analysis without APIs, but a cold offline visit still needs the static files to be served locally or available in browser cache.
- Tested in desktop Chromium with mobile emulation. No physical-device, Safari/Firefox, manual screen-reader, or native browser-zoom certification is claimed. Automated scans are not a guarantee of accessibility compliance.
- Social preview tags and image existence were checked locally; third-party social-network unfurl behavior was not tested.

## Source map

- `src/App.tsx`: shell, navigation, saved settings, request cancellation and refresh lifecycle.
- `src/components/`: dashboard, charts, guide, settings, and SVG icons.
- `src/data.ts`: public API parsing, demo data, validated settings loading.
- `src/analysis.ts`: sentiment, indicators, formatting, CSV escaping.
- `src/decision.ts`: documented action rules, confidence, freshness gates, and long/short price levels.
- `src/styles.css`: implemented visual system and responsive rules.
- `scripts/validate-browser.mjs`: production interaction and accessibility validation.
- `scripts/generate-social-card.mjs`: optional rasterization helper; requires a separately supplied `artifacts/social-card.svg` and installed Playwright Chromium. The complete runtime PNG is already in `public/` and `dist/`.
- `DESIGN.md`: final tokens, typography, layouts, components, and behavior.
- `artifacts/`: review evidence, screenshots, results, and attribution.

The local font and design-guidance licenses are retained. See `artifacts/ATTRIBUTION.md`. No reference-project code was copied.
