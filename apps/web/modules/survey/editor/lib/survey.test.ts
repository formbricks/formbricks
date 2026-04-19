import { ActionClass } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { updateSurveyInternal } from "@/lib/survey/service";
import { checkTriggersValidity, handleTriggerUpdates, updateSurvey, updateSurveyDraft } from "./survey";

vi.mock("@/lib/survey/service", () => ({
  updateSurveyInternal: vi.fn(),
}));

describe("Survey Editor Library Tests", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockSurvey = {
    id: "survey123",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Test Survey",
    type: "app",
    workspaceId: "workspace-id-mock",
    createdBy: "user123",
    status: "draft",
    displayOption: "displayOnce",
    questions: [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Question 1" },
        required: false,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
    welcomeCard: {
      enabled: false,
      timeToFinish: true,
      showResponseCount: false,
    },
    triggers: [],
    endings: [],
    hiddenFields: { enabled: false },
    delay: 0,
    autoComplete: null,
    publishOn: null,
    closeOn: null,
    workspaceOverwrites: null,
    styling: null,
    showLanguageSwitch: false,
    segment: null,
    surveyClosedMessage: null,
    singleUse: null,
    isVerifyEmailEnabled: false,
    recaptcha: null,
    isSingleResponsePerEmailEnabled: false,
    isBackButtonHidden: false,
    isCaptureIpEnabled: false,
    pin: null,
    displayPercentage: null,
    languages: [],
    variables: [],
    followUps: [],
    metadata: {},
    slug: null,
    customHeadScripts: null,
    customHeadScriptsMode: null,
    blocks: [],
  } as unknown as TSurvey;

  describe("updateSurvey", () => {
    beforeEach(() => {
      vi.mocked(updateSurveyInternal).mockResolvedValue(mockSurvey);
    });

    test("delegates to updateSurveyInternal with validation enabled", async () => {
      const result = await updateSurvey(mockSurvey);

      expect(updateSurveyInternal).toHaveBeenCalledWith(mockSurvey);
      expect(updateSurveyInternal).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSurvey);
    });

    test("propagates errors from updateSurveyInternal", async () => {
      const error = new Error("Internal update failed");
      vi.mocked(updateSurveyInternal).mockRejectedValueOnce(error);

      await expect(updateSurvey(mockSurvey)).rejects.toThrow("Internal update failed");
    });
  });

  describe("checkTriggersValidity", () => {
    const mockActionClasses: ActionClass[] = [
      {
        id: "action1",
        name: "Action 1",
        description: "Test Action 1",
        type: "code" as const,
        workspaceId: "workspace-id-mock",
        createdAt: new Date(),
        updatedAt: new Date(),
        key: null,
        noCodeConfig: null,
      },
      {
        id: "action2",
        name: "Action 2",
        description: "Test Action 2",
        type: "noCode" as const,
        workspaceId: "workspace-id-mock",
        createdAt: new Date(),
        updatedAt: new Date(),
        key: null,
        noCodeConfig: null,
      },
    ];

    const createFullActionClass = (id: string, type: "code" | "noCode" = "code"): ActionClass => ({
      id,
      name: `Action ${id}`,
      description: `Test Action ${id}`,
      type,
      workspaceId: "workspace-id-mock",
      createdAt: new Date(),
      updatedAt: new Date(),
      key: null,
      noCodeConfig: null,
    });

    test("does not throw for valid triggers", () => {
      const triggers = [
        { actionClass: createFullActionClass("action1") },
        { actionClass: createFullActionClass("action2", "noCode") },
      ];

      expect(() => checkTriggersValidity(triggers as never, mockActionClasses)).not.toThrow();
    });

    test("throws for invalid trigger ids", () => {
      const triggers = [
        { actionClass: createFullActionClass("action1") },
        { actionClass: createFullActionClass("invalid") },
      ];

      expect(() => checkTriggersValidity(triggers as never, mockActionClasses)).toThrow(InvalidInputError);
      expect(() => checkTriggersValidity(triggers as never, mockActionClasses)).toThrow("Invalid trigger id");
    });

    test("throws for duplicate trigger ids", () => {
      const triggers = [
        { actionClass: createFullActionClass("action1") },
        { actionClass: createFullActionClass("action1") },
      ];

      expect(() => checkTriggersValidity(triggers as never, mockActionClasses)).toThrow(InvalidInputError);
      expect(() => checkTriggersValidity(triggers as never, mockActionClasses)).toThrow(
        "Duplicate trigger id"
      );
    });

    test("does nothing when triggers are undefined", () => {
      expect(() => checkTriggersValidity(undefined as never, mockActionClasses)).not.toThrow();
    });
  });

  describe("handleTriggerUpdates", () => {
    const mockActionClasses: ActionClass[] = [
      {
        id: "action1",
        name: "Action 1",
        description: "Test Action 1",
        type: "code" as const,
        workspaceId: "workspace-id-mock",
        createdAt: new Date(),
        updatedAt: new Date(),
        key: null,
        noCodeConfig: null,
      },
      {
        id: "action2",
        name: "Action 2",
        description: "Test Action 2",
        type: "noCode" as const,
        workspaceId: "workspace-id-mock",
        createdAt: new Date(),
        updatedAt: new Date(),
        key: null,
        noCodeConfig: null,
      },
      {
        id: "action3",
        name: "Action 3",
        description: "Test Action 3",
        type: "noCode" as const,
        workspaceId: "workspace-id-mock",
        createdAt: new Date(),
        updatedAt: new Date(),
        key: null,
        noCodeConfig: null,
      },
    ];

    const createActionClassObj = (id: string, type: "code" | "noCode" = "code"): ActionClass => ({
      id,
      name: `Action ${id}`,
      description: `Test Action ${id}`,
      type,
      workspaceId: "workspace-id-mock",
      createdAt: new Date(),
      updatedAt: new Date(),
      key: null,
      noCodeConfig: null,
    });

    test("returns an empty object when updatedTriggers is undefined", () => {
      const result = handleTriggerUpdates(undefined as never, [], mockActionClasses);
      expect(result).toEqual({});
    });

    test("identifies added triggers correctly", () => {
      const currentTriggers = [{ actionClass: createActionClassObj("action1") }];
      const updatedTriggers = [
        { actionClass: createActionClassObj("action1") },
        { actionClass: createActionClassObj("action2", "noCode") },
      ];

      const result = handleTriggerUpdates(
        updatedTriggers as never,
        currentTriggers as never,
        mockActionClasses
      );

      expect(result).toEqual({
        create: [{ actionClassId: "action2" }],
      });
    });

    test("identifies deleted triggers correctly", () => {
      const currentTriggers = [
        { actionClass: createActionClassObj("action1") },
        { actionClass: createActionClassObj("action2", "noCode") },
      ];
      const updatedTriggers = [{ actionClass: createActionClassObj("action1") }];

      const result = handleTriggerUpdates(
        updatedTriggers as never,
        currentTriggers as never,
        mockActionClasses
      );

      expect(result).toEqual({
        deleteMany: {
          actionClassId: {
            in: ["action2"],
          },
        },
      });
    });

    test("handles both added and deleted triggers", () => {
      const currentTriggers = [
        { actionClass: createActionClassObj("action1") },
        { actionClass: createActionClassObj("action2", "noCode") },
      ];
      const updatedTriggers = [
        { actionClass: createActionClassObj("action1") },
        { actionClass: createActionClassObj("action3", "noCode") },
      ];

      const result = handleTriggerUpdates(
        updatedTriggers as never,
        currentTriggers as never,
        mockActionClasses
      );

      expect(result).toEqual({
        create: [{ actionClassId: "action3" }],
        deleteMany: {
          actionClassId: {
            in: ["action2"],
          },
        },
      });
    });

    test("validates triggers before processing", () => {
      const currentTriggers = [{ actionClass: createActionClassObj("action1") }];
      const updatedTriggers = [
        { actionClass: createActionClassObj("action1") },
        { actionClass: createActionClassObj("invalid") },
      ];

      expect(() =>
        handleTriggerUpdates(updatedTriggers as never, currentTriggers as never, mockActionClasses)
      ).toThrow(InvalidInputError);
    });
  });

  describe("updateSurveyDraft", () => {
    beforeEach(() => {
      vi.mocked(updateSurveyInternal).mockResolvedValue(mockSurvey);
    });

    test("calls updateSurveyInternal with skipValidation=true", async () => {
      await updateSurveyDraft(mockSurvey);

      expect(updateSurveyInternal).toHaveBeenCalledWith(mockSurvey, true);
      expect(updateSurveyInternal).toHaveBeenCalledTimes(1);
    });

    test("returns the survey from updateSurveyInternal", async () => {
      const result = await updateSurveyDraft(mockSurvey);

      expect(result).toEqual(mockSurvey);
    });

    test("propagates generic errors from updateSurveyInternal", async () => {
      const error = new Error("Internal update failed");
      vi.mocked(updateSurveyInternal).mockRejectedValueOnce(error);

      await expect(updateSurveyDraft(mockSurvey)).rejects.toThrow("Internal update failed");
    });

    test("propagates ResourceNotFoundError from updateSurveyInternal", async () => {
      vi.mocked(updateSurveyInternal).mockRejectedValueOnce(new ResourceNotFoundError("Survey", "survey123"));

      await expect(updateSurveyDraft(mockSurvey)).rejects.toThrow(ResourceNotFoundError);
    });

    test("propagates DatabaseError from updateSurveyInternal", async () => {
      vi.mocked(updateSurveyInternal).mockRejectedValueOnce(new DatabaseError("Database connection failed"));

      await expect(updateSurveyDraft(mockSurvey)).rejects.toThrow(DatabaseError);
    });
  });
});
