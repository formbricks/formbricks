import { beforeEach, describe, expect, test, vi } from "vitest";
import { cache } from "@/lib/cache";
import * as constants from "@/lib/constants";
import { evaluatePostHogFeatureFlag } from "@/lib/posthog/get-feature-flag";
import {
  CUSTOM_CSS_ROLLOUT_FRESH_TTL_MS,
  CUSTOM_CSS_ROLLOUT_LAST_KNOWN_TTL_MS,
  getIsCustomCssRolledOut,
} from "./rollout";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/constants", () => ({ IS_FORMBRICKS_CLOUD: true }));
vi.mock("@/lib/posthog/get-feature-flag", () => ({ evaluatePostHogFeatureFlag: vi.fn() }));

const store = new Map<string, unknown>();
vi.mock("@/lib/cache", () => ({
  cache: {
    get: vi.fn(async (key: string) => ({ ok: true, data: store.get(key) ?? null })),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
      return { ok: true, data: undefined };
    }),
  },
}));

const FRESH = "fb:org:org_1:custom-css-rollout";
const LAST_KNOWN = "fb:org:org_1:custom-css-rollout-last-known";

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  vi.mocked(constants).IS_FORMBRICKS_CLOUD = true;
});

describe("getIsCustomCssRolledOut", () => {
  test("self-hosted is always rolled out, without PostHog or the cache", async () => {
    vi.mocked(constants).IS_FORMBRICKS_CLOUD = false;

    await expect(getIsCustomCssRolledOut("org_1")).resolves.toBe(true);
    expect(evaluatePostHogFeatureFlag).not.toHaveBeenCalled();
    expect(cache.get).not.toHaveBeenCalled();
  });

  test("asks PostHog for the organization group and remembers the answer", async () => {
    vi.mocked(evaluatePostHogFeatureFlag).mockResolvedValue({ status: "evaluated", value: true });

    await expect(getIsCustomCssRolledOut("org_1")).resolves.toBe(true);

    expect(evaluatePostHogFeatureFlag).toHaveBeenCalledWith("org_1", "custom-css", {
      organizationId: "org_1",
    });
    expect(cache.set).toHaveBeenCalledWith(FRESH, { enabled: true }, CUSTOM_CSS_ROLLOUT_FRESH_TTL_MS);
    expect(cache.set).toHaveBeenCalledWith(
      LAST_KNOWN,
      { enabled: true },
      CUSTOM_CSS_ROLLOUT_LAST_KNOWN_TTL_MS
    );
  });

  test("a fresh decision is reused without asking PostHog", async () => {
    store.set(FRESH, { enabled: true });

    await expect(getIsCustomCssRolledOut("org_1")).resolves.toBe(true);
    expect(evaluatePostHogFeatureFlag).not.toHaveBeenCalled();
  });

  test("explicitly off, or missing, is off — and replaces an earlier on as the last known decision", async () => {
    store.set(LAST_KNOWN, { enabled: true });
    vi.mocked(evaluatePostHogFeatureFlag).mockResolvedValue({ status: "evaluated", value: false });

    await expect(getIsCustomCssRolledOut("org_1")).resolves.toBe(false);
    expect(store.get(LAST_KNOWN)).toEqual({ enabled: false });
  });

  test("a variant counts as on", async () => {
    vi.mocked(evaluatePostHogFeatureFlag).mockResolvedValue({ status: "evaluated", value: "beta" });
    await expect(getIsCustomCssRolledOut("org_1")).resolves.toBe(true);
  });

  test("PostHog unreachable reuses the last decision it returned", async () => {
    store.set(LAST_KNOWN, { enabled: true });
    vi.mocked(evaluatePostHogFeatureFlag).mockResolvedValue({ status: "unavailable" });

    await expect(getIsCustomCssRolledOut("org_1")).resolves.toBe(true);
    // The fallback is held briefly, but never written back as a decision PostHog made.
    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith(FRESH, { enabled: true }, CUSTOM_CSS_ROLLOUT_FRESH_TTL_MS);
  });

  test("PostHog unreachable with no earlier decision is off", async () => {
    vi.mocked(evaluatePostHogFeatureFlag).mockResolvedValue({ status: "unavailable" });

    await expect(getIsCustomCssRolledOut("org_1")).resolves.toBe(false);
    expect(store.has(LAST_KNOWN)).toBe(false);
  });

  test("a cache outage degrades to asking PostHog", async () => {
    vi.mocked(cache.get).mockRejectedValueOnce(new Error("redis down"));
    vi.mocked(evaluatePostHogFeatureFlag).mockResolvedValue({ status: "evaluated", value: true });

    await expect(getIsCustomCssRolledOut("org_1")).resolves.toBe(true);
  });
});
