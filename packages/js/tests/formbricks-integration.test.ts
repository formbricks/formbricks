// formbricks-integration.test.js

const puppeteer = require("puppeteer");
const path = require("path");

let browser;
let page;

beforeAll(async () => {
  browser = await puppeteer.launch({ headless: "old" });
  page = await browser.newPage();
});

afterAll(async () => {
  await browser.close();
});

describe("formbricks integration test", () => {
  it("should load formbricks successfully", async () => {
    await page.goto(`file://${path.resolve(__dirname, "./test.html")}`);
    const isFormbricksLoaded = await page.waitForFunction(
      () => {
        return window.formbricks !== undefined;
      },
      { timeout: 10000 }
    );

    expect(isFormbricksLoaded).toBeTruthy();
  });
});
