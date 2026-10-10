# Pulse — personal market perspective

A static, single-user crypto research app inspired by [Jev X Sentiment Analysis](https://github.com/brainstormity/Jev-X-Sentiment-Analysis). Built with React, TypeScript, and Vite. The ready-to-host production site is included in **`dist/`**, alongside source and `package-lock.json`.

![Pulse dashboard](artifacts/home-desktop.png)

## Use the app

1. Start with the labeled demo workspace, or select **Analyze market** to load public data.
2. Choose Bitcoin, Ethereum, Solana, or Chainlink. Compare sentiment, price, RSI, volume, VWAP, moving average, funding, and open interest.
3. Change chart metric/window, inspect an observation, filter headlines, or open the illustrative ATR price levels. Export a CSV to save the current analysis and provenance.
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

Technical calculations are in `src/analysis.ts`: Wilder RSI(14), session VWAP from midnight UTC, SMA(20), and the mean true range of the last 14 completed candles. The illustrative long scenario uses the current price, a stop 1.5 ATR lower, and a target 3 ATR higher. It is a reference calculation, not an executed order or personalized recommendation; fees and slippage are excluded.

The reference project’s paid X ingestion, TypeSafe model, arbitrary-asset coverage, engagement/author-diversity analysis, squeeze probability, and trade-action confidence are **not reproduced**. This browser-only adaptation uses four supported markets and public/local inputs. It does not pretend the HN sample is X sentiment or a representative cross-section of traders.

## Validation

Actual worker checks on **2026-10-10**, Node 24.21.0 / npm 11.19.0:

| Check                      | Result                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`        | Passed, zero TypeScript errors                                                                                                                        |
| `npm test`                 | 14 calculation/parsing/storage/CSV tests passed                                                                                                       |
| `npm run build`            | Passed; complete relative-URL static export in `dist/`                                                                                                |
| `npm run validate:browser` | 19 production interaction checks passed; 7 axe scans found zero violations; details in `artifacts/validation.md` and `artifacts/browser-results.json` |
| Live browser requests      | Kraken OHLC + ticker, Algolia search, Binance funding + open interest returned HTTP 200; no console errors on the repaired integration                |
| Better Interface review    | All six domains reviewed; findings fixed and limitations recorded in `artifacts/validation.md`                                                        |

To repeat the browser checks:

```sh
npx playwright install chromium
npm run build
npm run validate:browser
```

The script starts its own temporary static server under `/preview/`, tests the actual export, and closes both server and browser. Reports go to `test/scratch/validation/`; `PULSE_REPORT_DIR` can select another output location. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing Chromium executable. API success/failure/empty/stale/refresh tests use deterministic intercepted responses; the separate live check establishes only availability at the time it ran.

To avoid creating dependencies in this repository during the assignment, the worker installed from this package/lockfile in `/tmp/pulse-build`, copied the exact source/configuration there, ran the scripts, and copied the clean export back. Dependencies and npm caches remained outside the submission. Formatting tooling created a local `node_modules/.cache/prettier` directory; it is excluded without editing its contents. The delivered scripts work with a normal `npm ci` installation.

## Limitations

- Public services can fail, rate-limit, change CORS policy, or block a region. Requests time out after 12 seconds. Sources fail independently; failed fields become unavailable, with retry and demo recovery. No proxy is required or bundled.
- HN is technology-focused and often sparse. In the live Bitcoin check it returned four headlines, with the newest several days old. The app now displays headline age and withholds the intraday summary when the newest title is at least 24 hours old. Fresh pasted text can be scored separately. Sarcasm, complex context, bots, and authorship quality are not modeled.
- Spot and perpetual data come from different exchanges and quote markets. Funding period lengths may vary. The source drawer identifies providers and timestamps; data is not a whole-market aggregate.
- There is no service worker: a previously loaded page supports demo/local analysis without APIs, but a cold offline visit still needs the static files to be served locally or available in browser cache.
- Tested in desktop Chromium with mobile emulation. No physical-device, Safari/Firefox, manual screen-reader, or native browser-zoom certification is claimed. Automated scans are not a guarantee of accessibility compliance.
- Social preview tags and image existence were checked locally; third-party social-network unfurl behavior was not tested.

## Source map

- `src/App.tsx`: shell, navigation, saved settings, request cancellation and refresh lifecycle.
- `src/components/`: dashboard, charts, guide, settings, and SVG icons.
- `src/data.ts`: public API parsing, demo data, validated settings loading.
- `src/analysis.ts`: sentiment, indicators, formatting, CSV escaping.
- `src/styles.css`: implemented visual system and responsive rules.
- `scripts/validate-browser.mjs`: production interaction and accessibility validation.
- `scripts/generate-social-card.mjs`: optional regeneration of the PNG from `artifacts/social-card.svg`; requires installed Playwright Chromium.
- `DESIGN.md`: final tokens, typography, layouts, components, and behavior.
- `artifacts/`: review evidence, screenshots, results, and attribution.

The local font and design-guidance licenses are retained. See `artifacts/ATTRIBUTION.md`. No reference-project code was copied.
