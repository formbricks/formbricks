import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TActionClass } from "@formbricks/types/action-classes";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getActionClasses } from "@/lib/actionClass/service";
import { lockSurveyVisibility } from "@/lib/authzed/survey";
import { SurveyLinkedCreativesError } from "@/modules/ee/creatives/lib/linked-creatives";
import { mockActionClass, mockSurveyOutput, updateSurveyInput } from "./__mock__/survey.mock";
import { updateSurvey } from "./service";

/**
 * Single-use and PIN-protected surveys can't be a creative's Destination, so turning either on for
 * a survey that linked creatives open is refused (409) — before anything is written, and again under the
 * lock a creative link takes, inside the write's transaction.
 */

vi.mock("@/lib/actionClass/service", () => ({ getActionClasses: vi.fn() }));
vi.mock("@/lib/feedback-source/mapping-reconciliation", () => ({
  scheduleFeedbackSourceReconciliation: vi.fn(),
}));
vi.mock("@/lib/authzed/survey", () => ({ lockSurveyVisibility: vi.fn() }));

const linked = [{ id: "clcr1234567890123456789012", name: "Feedback tab" }];

const singleUseOn = { ...updateSurveyInput, singleUse: { enabled: true, isEncrypted: true } } as TSurvey;
const pinOn = { ...updateSurveyInput, pin: "1234" } as TSurvey;

const stored = (overrides: Partial<typeof mockSurveyOutput> = {}) => {
  const row = { ...mockSurveyOutput, ...overrides };
  vi.mocked(prisma.survey.findUnique).mockResolvedValue(row as never);
  vi.mocked(prisma.survey.findUniqueOrThrow).mockResolvedValue(row as never);
};

beforeEach(() => {
  vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(prisma));
  vi.mocked(prisma.surveyEmbeddedData.findMany).mockResolvedValue([]);
  vi.mocked(prisma.survey.update).mockResolvedValue(mockSurveyOutput as never);
  vi.mocked(getActionClasses).mockResolvedValue([mockActionClass] as TActionClass[]);
  vi.mocked(lockSurveyVisibility).mockReset();
  stored();
});

describe("updateSurvey with creatives opening the survey", () => {
  test.each([
    ["single-use links", singleUseOn, "singleUse"],
    ["a PIN", pinOn, "pin"],
  ])("refuses to turn on %s, naming the creatives, and writes nothing", async (_label, input, change) => {
    vi.mocked(prisma.creative.findMany).mockResolvedValue(linked as never);

    const refusal = await updateSurvey(input).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(SurveyLinkedCreativesError);
    expect(refusal).toMatchObject({ statusCode: 409, blockedChange: change, creatives: linked });
    expect(prisma.survey.update).not.toHaveBeenCalled();
  });

  test("re-checks under the lock a creative link takes, so one linked meanwhile still refuses", async () => {
    vi.mocked(prisma.creative.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce(linked as never);

    await expect(updateSurvey(singleUseOn)).rejects.toBeInstanceOf(SurveyLinkedCreativesError);
    expect(lockSurveyVisibility).toHaveBeenCalledWith(prisma, mockSurveyOutput.id);
    expect(prisma.survey.update).not.toHaveBeenCalled();
  });

  test("turns single-use on when no creative opens the survey", async () => {
    vi.mocked(prisma.creative.findMany).mockResolvedValue([] as never);

    await updateSurvey(singleUseOn);

    expect(prisma.survey.update).toHaveBeenCalled();
  });

  test("checks nothing for a save that leaves single-use and the PIN as they were", async () => {
    stored({ pin: "1234" });

    await updateSurvey(pinOn);
    await updateSurvey(updateSurveyInput);

    expect(prisma.creative.findMany).not.toHaveBeenCalled();
    expect(lockSurveyVisibility).not.toHaveBeenCalled();
    expect(prisma.survey.update).toHaveBeenCalledTimes(2);
  });
});
