import { readdirSync } from "node:fs";
import { chromium } from "/home/user/formbricks/node_modules/playwright-core/index.mjs";

const here = new URL(".", import.meta.url).pathname;
const pages = readdirSync(`${here}pages`).filter((f) => f.endsWith(".html"));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const context = await browser.newContext({
  viewport: { width: 1100, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

for (const file of pages.sort()) {
  await page.goto(`file://${here}pages/${file}`);
  await page.waitForLoadState("load");
  const target = await page.locator("body > div").first();
  await target.screenshot({
    path: `${here}out/${file.replace(/\.html$/, ".jpg")}`,
    type: "jpeg",
    quality: 92,
  });
  console.log("shot", file);
}

await browser.close();
