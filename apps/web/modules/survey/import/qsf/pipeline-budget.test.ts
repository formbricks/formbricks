import { describe, expect, test, vi } from "vitest";
import { loadQsfFixture } from "./__fixtures__/load-fixture";
import type { TQsfPlanGenerate } from "./ai-plan";
import { QsfImportFailedError, QsfImportInputError, prepareQsfImport, runQsfImport } from "./pipeline";

const budget = vi.hoisted(() => ({ estimate: null as number | null, noLimits: false }));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/survey/lib/permission", () => ({ getExternalUrlsPermission: vi.fn(async () => true) }));
// Every part of the prompt is bounded, so no fixture is over the budget at the tightest limits; the
// refusals are reached by making the measurement report one that is.
vi.mock("./prompt", async (importOriginal) => {
  const original = await importOriginal<typeof import("./prompt")>();
  return {
    ...original,
    estimateQsfMinimumPromptChars: (...args: Parameters<typeof original.estimateQsfMinimumPromptChars>) =>
      budget.estimate ?? original.estimateQsfMinimumPromptChars(...args),
    chooseQsfPromptLimits: (...args: Parameters<typeof original.chooseQsfPromptLimits>) =>
      budget.noLimits ? null : original.chooseQsfPromptLimits(...args),
  };
});

describe("a survey too large for the prompt budget", () => {
  test("is refused by prepareQsfImport with a 422, before the stream opens", () => {
    budget.estimate = Number.MAX_SAFE_INTEGER;

    expect(() => prepareQsfImport(loadQsfFixture("simple.qsf"), "simple.qsf")).toThrow(QsfImportInputError);
    budget.estimate = null;
  });

  test("fails the import before any AI call when no limits fit it", async () => {
    const prepared = prepareQsfImport(loadQsfFixture("simple.qsf"), "simple.qsf");
    budget.noLimits = true;
    const generate = vi.fn<TQsfPlanGenerate>();

    const error = await runQsfImport({
      prepared,
      workspaceId: "clxx1234567890123456789012",
      organizationId: "org_1",
      userId: null,
      signal: new AbortController().signal,
      deadlineMs: 120_000,
      onProgress: () => undefined,
      generate,
    }).catch((caught: unknown) => caught);
    budget.noLimits = false;

    expect(error).toBeInstanceOf(QsfImportFailedError);
    expect((error as QsfImportFailedError).reason).toBe("prompt_budget");
    expect(generate).not.toHaveBeenCalled();
  });
});
