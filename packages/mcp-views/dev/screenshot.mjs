// Renders a view through the dev host and writes a screenshot.
// Usage: node dev/screenshot.mjs <view> <fixture> <out.png> [--theme=dark] [--width=420] [--wait=800]
//        [--dist=dist] [--chromium=/path/to/chrome]  (--chromium for images whose Chromium does not match
//        this Playwright version)
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [view, fixture, out, ...flags] = process.argv.slice(2);
if (!view || !fixture || !out) {
  console.error(
    "Usage: node dev/screenshot.mjs <view> <fixture> <out.png> [--theme=dark] [--width=420] [--wait=800]"
  );
  process.exit(1);
}
const flag = (name, fallback) =>
  flags.find((item) => item.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 4300 + Math.floor(Math.random() * 400);

const server = spawn(
  "node",
  [path.join(root, "dev", "serve.mjs"), String(port), `--dist=${flag("dist", "dist")}`],
  { stdio: "ignore" }
);
await new Promise((resolve) => setTimeout(resolve, 600));
const executablePath = flag("chromium", undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  const page = await browser.newPage({ viewport: { width: Number(flag("width", 760)) + 40, height: 900 } });
  page.on("console", (message) => {
    if (message.type() === "error") console.error("[view]", message.text());
  });
  page.on("pageerror", (error) => console.error("[pageerror]", error.message));
  await page.goto(
    `http://localhost:${port}/host.html?view=${view}&fixture=${fixture}&theme=${flag("theme", "light")}&width=${flag("width", 720)}`
  );
  await page.waitForTimeout(Number(flag("wait", 800)));
  await page.screenshot({ path: out, fullPage: true });
  console.log(out);
} finally {
  await browser.close();
  server.kill();
}
