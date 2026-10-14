import { test as base } from "@playwright/test";
import { type TApiClient, createApiClient } from "./api-client.ts";
import { type TConfig, loadConfig } from "./config.ts";
import { markTierFailed, readState } from "./run-state.ts";
import { type TTier, skipReason } from "./tiers.ts";

interface TCheckFixtures {
  config: TConfig;
  api: TApiClient;
}

/**
 * A `test` bound to one tier: it skips when an earlier tier it depends on failed, and records its
 * own failure so later tiers skip in turn.
 */
export const tierTest = (tier: TTier) => {
  const test = base.extend<TCheckFixtures>({
    // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring pattern here
    config: async ({}, use) => {
      await use(loadConfig(process.env));
    },
    api: async ({ config }, use) => {
      await use(createApiClient(config));
    },
  });

  test.beforeEach(() => {
    const reason = skipReason(tier, readState().failedTiers);
    test.skip(reason !== undefined, reason);
  });

  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring pattern here
  test.afterEach(({}, testInfo) => {
    if (testInfo.status !== "skipped" && testInfo.status !== testInfo.expectedStatus) {
      markTierFailed(tier);
    }
  });

  return test;
};

export { expect } from "@playwright/test";
