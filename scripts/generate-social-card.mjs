import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  const svg = await readFile(
    new URL("../artifacts/social-card.svg", import.meta.url),
    "utf8",
  );
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await page.screenshot({
    path: new URL("../public/social-card.png", import.meta.url).pathname,
  });
} finally {
  await browser.close();
}
