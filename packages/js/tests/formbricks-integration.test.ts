// formbricks-integration.test.js

const puppeteer = require("puppeteer");
const path = require("path");

let browser;
let page;

beforeAll(async () => {
  browser = await puppeteer.launch();
  page = await browser.newPage();
});

afterAll(async () => {
  await browser.close();
});

describe("formbricks integration test", () => {
  it("should load formbricks successfully", async () => {
    await page.goto(`file://${path.resolve(__dirname, "./test.html")}`);

    // The `waitForFunction` will periodically check the page to see if formbricks has loaded
    const isFormbricksLoaded = await page.waitForFunction(
      () => {
        return window.formbricks !== undefined;
      },
      { timeout: 10000 }
    ); // adjust the timeout as needed

    expect(isFormbricksLoaded).toBeTruthy();
  });
});
