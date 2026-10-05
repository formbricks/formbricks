import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import type { TActionClass } from "@formbricks/types/action-classes";
import type { TCustomCssInput, TCustomCssStored } from "@formbricks/types/custom-css";
import { InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getActionClasses } from "@/lib/actionClass/service";
import { cache } from "@/lib/cache";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getCustomCssPlanAllowed } from "@/modules/custom-css/lib/access";
import { processCustomCss } from "@/modules/custom-css/processor";
import {
  createSurveyInput,
  mockActionClass,
  mockOrganizationOutput,
  mockSurveyOutput,
  updateSurveyInput,
} from "./__mock__/survey.mock";
import { createSurvey, updateSurvey, updateSurveyInternal } from "./service";

/**
 * ENG-2949: the editor's save and autosave hand `updateSurveyInternal` the whole survey, custom CSS
 * included in its stored shape. These pin that the shared custom CSS service decides what is written:
 * source only, normalized comparison, the plan only for real additions and edits.
 */

vi.mock("@/lib/organization/service", () => ({
  getOrganizationByWorkspaceId: vi.fn(),
  subscribeOrganizationMembersToSurveyResponses: vi.fn(),
}));
vi.mock("@/lib/actionClass/service", () => ({ getActionClasses: vi.fn() }));
vi.mock("@/lib/feedback-source/mapping-reconciliation", () => ({
  scheduleFeedbackSourceReconciliation: vi.fn(),
}));
vi.mock("@/lib/cache", () => ({ cache: { del: vi.fn() } }));
vi.mock("@/modules/custom-css/processor", () => ({
  CUSTOM_CSS_PROCESSOR_VERSION: 4,
  processCustomCss: vi.fn(),
  normalizeCustomCssInput: (input: { light: string | null; dark: string | null } | null | undefined) => {
    const light = input?.light?.trim() ? input.light : null;
    const dark = input?.dark?.trim() ? input.dark : null;
    return light === null && dark === null ? null : { light, dark };
  },
}));
vi.mock("@/modules/custom-css/lib/access", () => ({
  CUSTOM_CSS_PLAN_REQUIRED_MESSAGE: "Adding or editing custom CSS requires the Scale plan.",
  getCustomCssPlanAllowed: vi.fn(),
}));

const storedCss: TCustomCssStored = {
  light: { source: ".a{}", compiled: "@layer fb-survey{.a}" },
  dark: { source: ".b{}", compiled: "@layer fb-survey-dark{.b}" },
  processorVersion: 4,
};

const storedRow = { ...mockSurveyOutput, customCss: storedCss };

const lastUpdateData = (): Record<string, unknown> =>
  (vi.mocked(prisma.survey.update).mock.calls.at(-1)?.[0].data ?? {}) as Record<string, unknown>;

beforeEach(() => {
  vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(prisma));
  vi.mocked(prisma.surveyEmbeddedData.findMany).mockResolvedValue([]);
  vi.mocked(prisma.survey.findUniqueOrThrow).mockResolvedValue(storedRow as never);
  vi.mocked(prisma.survey.findUnique).mockResolvedValue(storedRow as never);
  vi.mocked(prisma.survey.update).mockResolvedValue(storedRow as never);
  vi.mocked(getActionClasses).mockResolvedValue([mockActionClass] as TActionClass[]);
  vi.mocked(getOrganizationByWorkspaceId).mockResolvedValue(mockOrganizationOutput);
  vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(true);
  vi.mocked(cache.del).mockResolvedValue({ ok: true, data: undefined });
  vi.mocked(processCustomCss).mockImplementation((({ input }: { input: TCustomCssInput }) => ({
    ok: true,
    compiled: {
      light: input.light ? `C(${input.light})` : null,
      dark: input.dark ? `CD(${input.dark})` : null,
    },
    warnings: [],
    processorVersion: 4,
  })) as never);
});

describe("updateSurveyInternal custom CSS", () => {
  test("the editor sending the stored CSS back is unchanged: no plan check, no processing, no write", async () => {
    vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(false);

    await updateSurvey({ ...updateSurveyInput, customCss: storedCss } as TSurvey);

    expect(getCustomCssPlanAllowed).not.toHaveBeenCalled();
    expect(processCustomCss).not.toHaveBeenCalled();
    expect(lastUpdateData()).not.toHaveProperty("customCss");
    expect(cache.del).not.toHaveBeenCalled();
  });

  test("a payload without customCss leaves the stored CSS untouched", async () => {
    const { customCss: _omit, ...withoutCss } = { ...updateSurveyInput, customCss: undefined };

    await updateSurvey(withoutCss as TSurvey);

    expect(lastUpdateData()).not.toHaveProperty("customCss");
  });

  test("caller-supplied compiled output never reaches the row", async () => {
    await updateSurvey({
      ...updateSurveyInput,
      customCss: {
        light: { source: ".a{}", compiled: "#fbjs{position:fixed}" },
        dark: { source: ".b{}", compiled: "" },
        processorVersion: 999,
      },
    } as TSurvey);

    expect(lastUpdateData()).not.toHaveProperty("customCss");
  });

  test('an edited field carrying compiled: "" is reprocessed and stored with trusted output', async () => {
    await updateSurvey({
      ...updateSurveyInput,
      customCss: {
        light: { source: ".a{color:red}", compiled: "" },
        dark: storedCss.dark,
        processorVersion: 4,
      },
    } as TSurvey);

    expect(getCustomCssPlanAllowed).toHaveBeenCalledWith(mockOrganizationOutput.id);
    expect(processCustomCss).toHaveBeenCalledWith({
      scope: "survey",
      input: { light: ".a{color:red}", dark: ".b{}" },
    });
    expect(lastUpdateData().customCss).toEqual({
      light: { source: ".a{color:red}", compiled: "C(.a{color:red})" },
      dark: { source: ".b{}", compiled: "CD(.b{})" },
      processorVersion: 4,
    });
    expect(cache.del).toHaveBeenCalledWith([`fb:env:${mockSurveyOutput.workspaceId}:state`]);
  });

  test("a downgraded organization cannot edit, and nothing is written", async () => {
    vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(false);

    await expect(
      updateSurvey({
        ...updateSurveyInput,
        customCss: { light: { source: ".new{}", compiled: "" }, dark: null, processorVersion: 0 },
      } as TSurvey)
    ).rejects.toBeInstanceOf(OperationNotAllowedError);
    expect(prisma.survey.update).not.toHaveBeenCalled();
  });

  test("a downgraded organization can still clear its CSS", async () => {
    vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(false);

    await updateSurvey({ ...updateSurveyInput, customCss: null } as TSurvey);

    expect(lastUpdateData().customCss).toBe(Prisma.DbNull);
    expect(getCustomCssPlanAllowed).not.toHaveBeenCalled();
  });

  test("CSS the processor rejects fails the save and keeps the stored revision", async () => {
    vi.mocked(processCustomCss).mockResolvedValue({
      ok: false,
      errors: [
        {
          code: "syntax_error",
          scope: "survey",
          appearance: "light",
          line: 1,
          column: 4,
          reason: "Unexpected",
        },
      ],
    });

    await expect(
      updateSurvey({
        ...updateSurveyInput,
        customCss: { light: { source: ".a{", compiled: "" }, dark: null, processorVersion: 4 },
      } as TSurvey)
    ).rejects.toBeInstanceOf(InvalidInputError);
    expect(prisma.survey.update).not.toHaveBeenCalled();
  });

  test("the unvalidated draft save refuses a malformed value instead of storing it", async () => {
    vi.mocked(prisma.survey.findUnique).mockResolvedValue({ ...storedRow, status: "draft" } as never);

    await expect(
      updateSurveyInternal(
        { ...updateSurveyInput, status: "draft", customCss: { light: "raw string", dark: null } } as never,
        true
      )
    ).rejects.toBeInstanceOf(InvalidInputError);
    expect(prisma.survey.update).not.toHaveBeenCalled();
  });
});

describe("createSurvey custom CSS", () => {
  beforeEach(() => {
    vi.mocked(prisma.survey.create).mockResolvedValue(mockSurveyOutput as never);
    vi.mocked(prisma.survey.findUniqueOrThrow).mockResolvedValue(mockSurveyOutput as never);
  });

  test("strips customCss from a generic create payload", async () => {
    await createSurvey(
      mockSurveyOutput.workspaceId,
      { ...createSurveyInput, customCss: storedCss } as never,
      { creationFacts: { ownerId: null, visibility: "workspace" } }
    );

    expect(vi.mocked(prisma.survey.create).mock.calls[0][0].data).not.toHaveProperty("customCss");
  });

  test("writes only CSS the shared service resolved, handed in through the options", async () => {
    await createSurvey(mockSurveyOutput.workspaceId, createSurveyInput, {
      creationFacts: { ownerId: null, visibility: "workspace" },
      customCss: storedCss,
    });

    expect(vi.mocked(prisma.survey.create).mock.calls[0][0].data).toMatchObject({ customCss: storedCss });
  });
});
