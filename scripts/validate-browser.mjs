import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, join } from "node:path";

// Serve the real export beneath a subpath. Both server and browser close in finally.
const root = resolve("dist");
const output = resolve(
  process.env.PULSE_REPORT_DIR || "test/scratch/validation",
);
await mkdir(output, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (!pathname.startsWith("/preview/")) {
      res.writeHead(404);
      res.end();
      return;
    }
    const file = resolve(
      root,
      pathname.slice("/preview/".length) || "index.html",
    );
    if (!file.startsWith(root + "/") && file !== join(root, "index.html")) {
      res.writeHead(403);
      res.end();
      return;
    }
    res.setHeader(
      "Content-Type",
      mime[extname(file)] || "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/preview/`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
  args: ["--no-sandbox", "--no-proxy-server"],
});
const results = [];
const checks = async (name, fn) => {
  await fn();
  results.push({ name, status: "pass" });
  console.log(`PASS ${name}`);
};
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
const missingAssets = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("response", (res) => {
  if (res.url().startsWith(base) && res.status() >= 400)
    missingAssets.push(`${res.status()} ${res.url()}`);
});
const nav = (name) =>
  page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name, exact: true });
const click = (name) => page.getByRole("button", { name, exact: true }).click();
const noOverflow = async () => {
  const widths = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(widths.document <= widths.viewport, JSON.stringify(widths));
};
const audits = [];
const contrastMeasurements = [];
const audit = async (label) => {
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  audits.push({
    label,
    violations: scan.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        failureSummary: n.failureSummary,
      })),
    })),
  });
  assert.equal(
    scan.violations.length,
    0,
    `${label}: ${scan.violations.map((v) => v.id).join(", ")}`,
  );
};
try {
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  await checks(
    "Production metadata, relative assets, local font and no initial API requests",
    async () => {
      assert.match(await page.title(), /Pulse/);
      for (const selector of [
        'meta[name="description"]',
        'meta[property="og:title"]',
        'meta[property="og:image"]',
        'link[rel="icon"]',
      ])
        assert.ok(
          await page
            .locator(selector)
            .getAttribute(selector.startsWith("link") ? "href" : "content"),
        );
      const paths = await page
        .locator('script[src],link[rel="stylesheet"]')
        .evaluateAll((nodes) =>
          nodes.map((n) =>
            n.getAttribute(n.tagName === "SCRIPT" ? "src" : "href"),
          ),
        );
      assert.ok(paths.every((p) => p.startsWith("./")));
      assert.equal(
        await page.evaluate(() => document.fonts.check("600 14px Manrope")),
        true,
      );
      assert.equal(
        (
          await page.request.get(new URL("./social-card.png", base).href)
        ).status(),
        200,
      );
      assert.equal(
        await page.locator(".badge.neutral").first().textContent(),
        "Demo data",
      );
      assert.equal(
        await page.evaluate(
          () =>
            performance
              .getEntriesByType("resource")
              .filter((r) => !r.name.startsWith(location.origin)).length,
        ),
        0,
      );
    },
  );
  await checks(
    "Desktop accessibility and first production screenshot",
    async () => {
      await noOverflow();
      await audit("Home desktop demo");
      await page.screenshot({
        path: join(output, "home-desktop.png"),
        fullPage: true,
      });
    },
  );
  await checks(
    "Rendered text, focus and control-boundary contrast",
    async () => {
      const samples = await page.evaluate(() => {
        const selectors = [
          ".metric-label",
          ".badge.bullish",
          ".badge.neutral",
          ".primary",
          ".secondary",
          ".primary-nav a[aria-current]",
          ".chart-label",
        ];
        return selectors.map((selector) => {
          const element = document.querySelector(selector),
            style = getComputedStyle(element);
          let current = element,
            background = "rgba(0, 0, 0, 0)";
          while (current && background === "rgba(0, 0, 0, 0)") {
            background = getComputedStyle(current).backgroundColor;
            current = current.parentElement;
          }
          return {
            selector,
            foreground: selector === ".chart-label" ? style.fill : style.color,
            background,
            border: style.borderColor,
          };
        });
      });
      const luminance = (color) => {
        const values = color
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number)
          .map((v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
      };
      const ratio = (a, b) => {
        const x = luminance(a),
          y = luminance(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      };
      for (const sample of samples) {
        const contrast = ratio(sample.foreground, sample.background);
        contrastMeasurements.push({
          ...sample,
          ratio: Number(contrast.toFixed(2)),
          role: "text",
        });
        assert.ok(contrast >= 4.5, `${sample.selector}: ${contrast}`);
        if (sample.selector === ".secondary") {
          const boundary = ratio(sample.border, sample.background);
          contrastMeasurements.push({
            selector: sample.selector,
            foreground: sample.border,
            background: sample.background,
            ratio: Number(boundary.toFixed(2)),
            role: "control boundary",
          });
          assert.ok(boundary >= 3);
        }
      }
      await page.locator(".primary").focus();
      const focus = await page.locator(".primary").evaluate((el) => ({
        foreground: getComputedStyle(el).outlineColor,
        background: getComputedStyle(document.documentElement).backgroundColor,
      }));
      const focusRatio = ratio(focus.foreground, focus.background);
      contrastMeasurements.push({
        ...focus,
        selector: ".primary:focus-visible",
        ratio: Number(focusRatio.toFixed(2)),
        role: "focus perimeter against page",
      });
      assert.ok(focusRatio >= 3);
      await page.locator("h1").click();
    },
  );
  await checks(
    "390px first screen exposes product and primary action; 320px and intermediate layouts reflow",
    async () => {
      for (const width of [390, 320, 570, 760, 800, 1060, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await noOverflow();
        if (width === 390) {
          const box = await page
            .getByRole("button", { name: "Analyze market", exact: true })
            .boundingBox();
          assert.ok(box.y >= 0 && box.y + box.height < 844);
          await page.screenshot({ path: join(output, "home-mobile.png") });
          await audit("Home mobile demo");
        }
        if (width === 320)
          await page.screenshot({ path: join(output, "home-320.png") });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    },
  );
  await checks(
    "Market selection updates price, chart labels and selected watchlist entry",
    async () => {
      await page.getByLabel("Your market").selectOption("ETH");
      assert.match(
        await page.locator(".metric-card").nth(1).textContent(),
        /Ethereum price/,
      );
      assert.match(
        await page.locator(".chart-panel").textContent(),
        /ETH \/ USD/,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Ξ Ethereum ETH" })
          .getAttribute("aria-pressed"),
        "true",
      );
      await page.getByLabel("Your market").selectOption("BTC");
    },
  );
  await checks(
    "Chart time windows, metric switching, keyboard inspector and data table",
    async () => {
      await click("Show 1 hour");
      assert.match(
        await page.locator(".data-details summary").textContent(),
        /13 observations/,
      );
      await click("Show 4 hours");
      assert.match(
        await page.locator(".data-details summary").textContent(),
        /49 observations/,
      );
      await click("Sentiment");
      assert.equal(
        await page
          .getByRole("button", { name: "Sentiment", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      await click("Show 24 hours");
      await click("Inspect data");
      const slider = page.getByRole("slider");
      await slider.focus();
      await slider.press("Home");
      assert.equal(await slider.inputValue(), "0");
      await slider.press("ArrowRight");
      assert.equal(await slider.inputValue(), "1");
      await page.locator(".data-details summary").click();
      assert.ok((await page.locator(".data-details tbody tr").count()) > 0);
      await page.locator(".data-details summary").click();
      await click("Close inspector");
      await click("Price");
    },
  );
  await checks(
    "Sentiment filters, expanded feed and scenario levels",
    async () => {
      await click("Bearish");
      assert.equal(await page.locator(".story-list>li").count(), 4);
      const badges = await page.locator(".story-list .badge").allTextContents();
      assert.ok(badges.every((t) => t.includes("Bearish")));
      await page.locator(".feed-filters button").first().click();
      await click("View all 25 headlines");
      assert.equal(await page.locator(".story-list>li").count(), 25);
      await click("Show fewer headlines");
      await click("Explore price levels");
      assert.match(
        await page.locator(".price-levels").textContent(),
        /2:1 before costs/,
      );
      await click("Explore price levels");
    },
  );
  await checks(
    "Local text analysis validates empty/oversized input and scores without a network request",
    async () => {
      await click("Analyze text");
      await click("Analyze headlines");
      assert.equal(
        await page
          .getByLabel("Headlines or posts")
          .getAttribute("aria-invalid"),
        "true",
      );
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        "headlines",
      );
      const before = await page.evaluate(
        () => performance.getEntriesByType("resource").length,
      );
      await page
        .getByLabel("Headlines or posts")
        .fill(
          "Bitcoin bullish growth\nA crash sparks fear\nThe market is not bullish\nA regular Thursday",
        );
      await click("Analyze headlines");
      assert.equal(await page.locator(".local-results li").count(), 4);
      assert.match(
        await page.locator(".local-summary").textContent(),
        /4 headlines/,
      );
      assert.match(
        await page.locator(".local-results li").nth(2).textContent(),
        /Bearish/,
      );
      assert.equal(
        await page.evaluate(
          () => performance.getEntriesByType("resource").length,
        ),
        before,
      );
      await page
        .getByLabel("Headlines or posts")
        .fill("bullish\n".repeat(1001));
      await click("Analyze headlines");
      assert.match(
        await page.locator("#text-error").textContent(),
        /up to 1,000 lines/,
      );
      await page
        .getByLabel("Headlines or posts")
        .fill('<script>alert("test")</script> strong growth');
      await click("Analyze headlines");
      assert.equal(await page.locator(".local-results script").count(), 0);
      await audit("Text analysis result and form");
      await click("Back to feed");
    },
  );
  await checks(
    "CSV download includes provenance, metrics and headline rows",
    async () => {
      const ready = page.waitForEvent("download");
      await click("Export");
      const download = await ready;
      assert.match(download.suggestedFilename(), /^pulse-btc-demo-.*\.csv$/);
      const text = await readFile(await download.path(), "utf8");
      assert.match(text, /"Mode","demo"/);
      assert.match(text, /"Title","Published UTC"/);
      assert.match(text, /"RSI 14"/);
    },
  );
  await checks(
    "Guide navigation, hash routing and indicators documentation",
    async () => {
      await nav("How to use").click();
      await page.waitForURL("**/#guide");
      await page
        .getByRole("heading", {
          level: 1,
          name: "A little context. A clearer view.",
        })
        .waitFor();
      assert.equal(
        await page.getByRole("heading", { level: 1 }).textContent(),
        "A little context. A clearer view.",
      );
      assert.match(await page.locator("main").textContent(), /Hacker News/);
      assert.match(await page.locator("main").textContent(), /Binance/);
      await audit("Guide desktop");
      await page.screenshot({
        path: join(output, "guide-desktop.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 320, height: 740 });
      await noOverflow();
      await page.setViewportSize({ width: 1440, height: 1000 });
    },
  );
  await checks(
    "Settings changes persist; restoring defaults requires save; default market applies on reload",
    async () => {
      await nav("Settings").click();
      await page.getByLabel("Default market").selectOption("SOL");
      await page.getByLabel("Conversation sample").selectOption("100");
      await page.getByLabel("Sentiment threshold").selectOption("70");
      await page.getByLabel("Chart time zone").selectOption("UTC");
      await page.getByLabel("Automatically refresh live data").uncheck();
      await page.locator(".watchlist-options").getByLabel("LINK").check();
      await click("Save settings");
      assert.match(
        await page.locator(".save-status").textContent(),
        /Settings saved/,
      );
      await page.reload();
      assert.equal(await page.getByLabel("Default market").inputValue(), "SOL");
      assert.equal(
        await page.getByLabel("Sentiment threshold").inputValue(),
        "70",
      );
      assert.equal(
        await page.getByLabel("Automatically refresh live data").isChecked(),
        false,
      );
      await click("Restore defaults");
      assert.equal(await page.getByLabel("Default market").inputValue(), "BTC");
      await page.reload();
      assert.equal(await page.getByLabel("Default market").inputValue(), "SOL");
      await nav("Home").click();
      assert.equal(await page.getByLabel("Your market").inputValue(), "SOL");
      await nav("Settings").click();
      await audit("Settings desktop");
      await page.screenshot({
        path: join(output, "settings-desktop.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow();
      await audit("Settings mobile");
      await page.screenshot({
        path: join(output, "settings-mobile.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 320, height: 740 });
      await noOverflow();
      await click("Restore defaults");
      await click("Save settings");
      await nav("Home").click();
      await page.reload();
      await page.setViewportSize({ width: 1440, height: 1000 });
    },
  );
  await checks(
    "Keyboard skip link, visible focus, navigation and primary action are reachable",
    async () => {
      await page.goto(base);
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(() => document.activeElement.textContent),
        "Skip to content",
      );
      await page.keyboard.press("Enter");
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        "main-content",
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(() => document.activeElement.textContent),
        "Export",
      );
      await page.keyboard.press("Tab");
      assert.match(
        await page.evaluate(() => document.activeElement.textContent),
        /Analyze market/,
      );
      const outline = await page.evaluate(() => {
        const s = getComputedStyle(document.activeElement);
        return {
          width: s.outlineWidth,
          style: s.outlineStyle,
          color: s.outlineColor,
        };
      });
      assert.equal(outline.width, "2px");
      assert.equal(outline.style, "solid");
      await page.screenshot({ path: join(output, "keyboard-focus.png") });
    },
  );
  await checks(
    "Reduced motion disables loading animation; forced colors retain selected controls",
    async () => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.evaluate(() =>
        document
          .querySelector(".heading-actions .primary svg")
          .classList.add("spinning"),
      );
      assert.equal(
        await page
          .locator(".heading-actions .primary svg")
          .evaluate((el) => getComputedStyle(el).animationName),
        "none",
      );
      await page.emulateMedia({ forcedColors: "active" });
      assert.equal(
        await page
          .locator('.period-toggle button[aria-pressed="true"]')
          .evaluate((el) => getComputedStyle(el).borderBottomWidth),
        "2px",
      );
      assert.equal(
        await page
          .locator('.segmented button[aria-pressed="true"]')
          .evaluate((el) => getComputedStyle(el).borderBottomWidth),
        "2px",
      );
      await page.screenshot({ path: join(output, "forced-colors.png") });
      await page.emulateMedia({ forcedColors: "none" });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.reload();
    },
  );
  // Browser response fixtures exercise deterministic interactions, not a claim about provider availability.
  let requests = 0,
    mode = "success";
  const fixtureTime = Date.now();
  await page.route("https://**/*", async (route) => {
    requests++;
    const url = route.request().url();
    if (mode === "failure") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      });
      return;
    }
    let body;
    if (url.includes("/OHLC"))
      body = {
        error: [],
        result: {
          XXBTZUSD: Array.from({ length: 360 }, (_, i) => [
            Math.floor(fixtureTime / 300000) * 300 - (359 - i) * 300,
            100 + i,
            102 + i,
            99 + i,
            101 + i,
            100 + i,
            20,
            1,
          ]),
          last: 1,
        },
      };
    else if (url.includes("/Ticker"))
      body = {
        error: [],
        result: {
          XXBTZUSD: {
            c: ["460"],
            o: "430",
            v: ["10", "120"],
            p: ["440", "445"],
            h: ["465", "470"],
            l: ["430", "420"],
          },
        },
      };
    else if (url.includes("algolia"))
      body = {
        hits:
          mode === "empty"
            ? []
            : [
                ["Bitcoin growth", "1"],
                ["Bitcoin bearish crash", "2"],
                ["Bitcoin Thursday", "3"],
              ].map(([title, objectID], i) => ({
                title,
                objectID,
                created_at_i:
                  Math.floor(fixtureTime / 1000) -
                  i * 1800 -
                  (mode === "stale" ? 72 * 3600 : 0),
                author: "fixture",
                points: 10,
                num_comments: 2,
              })),
      };
    else if (url.includes("/premiumIndex"))
      body = { lastFundingRate: "0.0001", time: fixtureTime };
    else if (url.includes("/openInterest"))
      body = { openInterest: "10000", time: fixtureTime };
    else {
      await route.abort();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await checks(
    "Live fetch populates all sources; unavailable source values never reuse demo numbers",
    async () => {
      await click("Analyze market");
      await page.getByText("Public data", { exact: true }).waitFor();
      assert.match(
        await page.locator(".metric-card").nth(1).textContent(),
        /\$460\.00/,
      );
      assert.match(
        await page.locator(".metric-card").first().textContent(),
        /3 headlines/,
      );
      assert.match(
        await page.locator(".indicator-strip").textContent(),
        /\+0\.0100%/,
      );
      assert.equal(requests, 5);
      await click("Pause automatic refresh");
      assert.ok(
        await page
          .getByRole("button", { name: "Resume automatic refresh" })
          .isVisible(),
      );
      await page.locator(".source-details summary").click();
      assert.match(
        await page.locator(".source-status-grid").textContent(),
        /Binance USDT/,
      );
    },
  );
  await checks(
    "Refresh scheduler updates at its interval and stops when paused, without real-time waiting",
    async () => {
      await page.clock.install();
      const before = requests;
      await click("Resume automatic refresh");
      await page.clock.fastForward(61000);
      await page
        .getByRole("button", { name: "Analyze market", exact: true })
        .waitFor();
      assert.equal(requests, before + 5);
      await click("Pause automatic refresh");
      const pausedRequests = requests;
      await page.clock.fastForward(180000);
      assert.equal(requests, pausedRequests);
    },
  );
  await checks(
    "Stale conversation data is dated and withheld from the intraday summary",
    async () => {
      mode = "stale";
      await click("Analyze market");
      await page.getByText("Wait for fresh context", { exact: true }).waitFor();
      assert.match(
        await page.locator(".data-notice").textContent(),
        /Newest headline is 72 hours old/,
      );
      assert.match(
        await page.locator(".factor-list").textContent(),
        /over 24 hours old/,
      );
    },
  );
  await checks(
    "Empty live sample offers an action and insufficient sentiment history stays empty",
    async () => {
      mode = "empty";
      await click("Analyze market");
      await page
        .getByText("No headlines in this sample", { exact: true })
        .waitFor();
      assert.match(
        await page.locator(".metric-card").first().textContent(),
        /No headlines available/,
      );
      await click("Sentiment");
      assert.match(
        await page.locator(".chart-empty").textContent(),
        /Not enough data/,
      );
      await click("Price");
    },
  );
  await checks(
    "Failed APIs show recoverable errors and empty values; mobile refresh control and demo recovery work",
    async () => {
      mode = "failure";
      await click("Analyze market");
      await page.getByText("Partial data", { exact: true }).waitFor();
      assert.match(
        await page.locator(".data-notice").textContent(),
        /Market prices are unavailable/,
      );
      assert.match(
        await page.locator(".metric-card").nth(1).textContent(),
        /—/,
      );
      assert.match(
        await page.locator(".insight-bias").textContent(),
        /Wait for more data/,
      );
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(
        await page
          .getByRole("button", { name: "Resume automatic refresh" })
          .isVisible(),
      );
      await noOverflow();
      await audit("All APIs unavailable mobile");
      await click("Use demo");
      assert.ok(await page.getByText("Demo data", { exact: true }).isVisible());
      assert.match(
        await page.locator(".metric-card").nth(1).textContent(),
        /\$67/,
      );
    },
  );
  await checks(
    "Browser runtime and local resources stay error-free",
    async () => {
      assert.deepEqual(errors, []);
      assert.deepEqual(missingAssets, []);
    },
  );
  await writeFile(
    join(output, "browser-results.json"),
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        base,
        results,
        audits,
        contrastMeasurements,
        errors,
        missingAssets,
        notes: [
          "Live success/error/empty/refresh tests use intercepted public-API fixtures.",
          "Real provider availability is checked separately.",
          "Narrow viewports are reflow tests, not native browser zoom.",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    `${results.length} browser checks passed. ${audits.length} accessibility scans had no violations. Reports: ${output}`,
  );
} catch (error) {
  await writeFile(
    join(output, "browser-results.json"),
    JSON.stringify(
      { results, audits, errors, missingAssets, failure: String(error) },
      null,
      2,
    ),
  );
  await page.screenshot({ path: join(output, "failure.png"), fullPage: true });
  throw error;
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
