import { gzipSync } from "node:zlib";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { CUSTOM_CSS_MAX_SOURCE_BYTES, type TCustomCssStored } from "@formbricks/types/custom-css";
import { getWorkspaceState } from "./environmentState";

/**
 * ENG-3552 payload budget: a workspace at the custom CSS limits, as the SDK downloads it. 30 app surveys
 * (the endpoint's `take`), workspace CSS at its 100 KB budget, every survey at its 20 KB budget — all
 * compiled output, which the processor holds to the same per-scope budget as the source.
 *
 * The real environment-state assembly runs (data shaping, delivery, legacy aliases); only the database,
 * cache and the delivery/rollout lookups are stubbed. Measured 2026-10-05 (ENG-3552 PR): 732 KB raw,
 * 69 KB gzip, ~10 ms to assemble and ~4 ms to serialize on a shared 4-CPU container.
 */

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: { workspace: { findUnique: vi.fn(), update: vi.fn() }, segment: { findMany: vi.fn() } },
}));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/cache", () => ({ cache: { withCache: vi.fn((fn: () => Promise<unknown>) => fn()) } }));
vi.mock("@/lib/constants", () => ({ IS_RECAPTCHA_CONFIGURED: false, POSTHOG_KEY: undefined }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: vi.fn() }));
vi.mock("@/lib/utils/validate", () => ({ validateInputs: vi.fn() }));
vi.mock("@/modules/storage/utils", () => ({ resolveStorageUrlsInObject: vi.fn((value: unknown) => value) }));
vi.mock("@/modules/survey/lib/utils", () => ({ transformPrismaSurvey: vi.fn((survey: unknown) => survey) }));
vi.mock("@/modules/custom-css/lib/rollout", () => ({ getIsCustomCssRolledOut: vi.fn(async () => true) }));
// Stored output at the current processor version is delivered as stored.
vi.mock("@/modules/custom-css/lib/delivery", () => ({
  toDeliveredCustomCss: vi.fn(async (stored: TCustomCssStored | null) =>
    stored
      ? {
          ...(stored.light ? { light: stored.light.compiled } : {}),
          ...(stored.dark ? { dark: stored.dark.compiled } : {}),
        }
      : undefined
  ),
}));

const SURVEY_COUNT = 30;

// Deterministic pseudo-random values, so the CSS compresses like a real theme rather than like one
// rule repeated a thousand times (which would flatter the compressed numbers).
let seed = 42;
const random = () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
  return seed / 2_147_483_648;
};
const PARTS = ["card", "headline", "description", "option", "option-label", "input", "button-primary"];
const hex = () =>
  `#${Math.floor(random() * 0xffffff)
    .toString(16)
    .padStart(6, "0")}`;

/** Compiled-looking CSS of exactly `bytes` UTF-8 bytes, wrapped in its layer. */
const compiledCss = (layer: string, scopePrefix: string, marker: string, bytes: number): string => {
  const open = `@layer ${layer}{/*${marker}*/`;
  let body = "";
  for (let rule = 0; open.length + body.length < bytes - 200; rule++) {
    const part = PARTS[rule % PARTS.length];
    body += `${scopePrefix} [data-fb-part="${part}"]:nth-child(${rule % 17}){color:${hex()}!important;border-radius:${Math.floor(random() * 24)}px!important;padding:${Math.floor(random() * 20)}px ${Math.floor(random() * 32)}px!important}`;
  }
  const css = `${open}${body}}`;
  return css.padEnd(bytes, " ");
};

const storedAtBudget = (scope: "workspace" | "survey", marker: string): TCustomCssStored => {
  const budget = CUSTOM_CSS_MAX_SOURCE_BYTES[scope];
  const lightBytes = Math.floor(budget * 0.7);
  const layer = scope === "workspace" ? "fb-workspace" : "fb-survey";
  return {
    light: { source: `/* SOURCE ${marker} */`, compiled: compiledCss(layer, "#fbjs", marker, lightBytes) },
    dark: {
      source: `/* SOURCE ${marker}-dark */`,
      compiled: compiledCss(
        `${layer}-dark`,
        '#fbjs[data-appearance="dark"]',
        `${marker}-dark`,
        budget - lightBytes
      ),
    },
    processorVersion: 1,
  };
};

const survey = (index: number) => ({
  id: `survey-${index}`,
  type: "app",
  status: "inProgress",
  welcomeCard: { enabled: false },
  questions: [],
  blocks: [],
  showLanguageSwitch: false,
  languages: [],
  endings: [],
  autoClose: null,
  styling: null,
  recaptcha: { enabled: false },
  segment: null,
  recontactDays: null,
  displayLimit: null,
  displayOption: "displayOnce",
  embeddedDataLinks: [],
  isBackButtonHidden: false,
  isAutoProgressingEnabled: false,
  triggers: [],
  displayPercentage: null,
  delay: 0,
  workspaceOverwrites: null,
  customCss: storedAtBudget("survey", `survey-${index}-css`),
});

describe("environment state payload at the custom CSS limits", () => {
  test("carries workspace CSS once and each survey's once, compiled only, within budget", async () => {
    const workspaceCss = storedAtBudget("workspace", "workspace-css");
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      id: "clworkspace000000000000001",
      organizationId: "org-1",
      legacyEnvironmentId: null,
      appSetupCompleted: true,
      recontactDays: 0,
      clickOutsideClose: true,
      overlay: "none",
      overlayColor: null,
      overlayOpacity: null,
      placement: "bottomRight",
      inAppSurveyBranding: true,
      styling: { allowStyleOverwrite: true },
      customCss: workspaceCss,
      actionClasses: [],
      surveys: Array.from({ length: SURVEY_COUNT }, (_, index) => survey(index)),
    } as never);

    const { data } = await getWorkspaceState("clworkspace000000000000001");
    const body = JSON.stringify({ data, expiresAt: new Date() });

    const occurrences = (needle: string) => body.split(needle).length - 1;
    // Workspace CSS once — not per survey, not again in the legacy `project` alias.
    expect(occurrences("/*workspace-css*/")).toBe(1);
    expect(occurrences("/*workspace-css-dark*/")).toBe(1);
    for (let index = 0; index < SURVEY_COUNT; index++) {
      expect(occurrences(`/*survey-${index}-css*/`)).toBe(1);
    }
    // Never the source or processor internals.
    expect(body).not.toContain("SOURCE");
    expect(body).not.toContain("processorVersion");

    // 100 KB + 30 × 20 KB of CSS plus the survey JSON; copying the workspace CSS into each survey
    // instead would add ~2.9 MB. Compressed, it is what a respondent actually downloads.
    expect(Buffer.byteLength(body)).toBeLessThan(800_000);
    expect(gzipSync(body).length).toBeLessThan(150_000);
  });
});
