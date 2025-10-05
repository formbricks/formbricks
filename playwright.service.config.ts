import { ServiceOS, getServiceConfig } from "@azure/microsoft-playwright-testing";
import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

/* Learn more about service configuration at https://aka.ms/mpt/config */
export default defineConfig(
  config,
  getServiceConfig(config, {
    exposeNetwork: "<loopback>",
    timeout: 33000,
    os: ServiceOS.LINUX,
    useCloudHostedBrowsers: true, // Set to false if you want to only use reporting and not cloud hosted browsers
  }),
  {
    /* 
    Playwright Testing service reporter is added by default.
    This will override any reporter options specified in the base playwright config.
    If you are using more reporters, please update your configuration accordingly.
    */
    reporter: [["list"], ["@azure/microsoft-playwright-testing/reporter"]],
  }
);
