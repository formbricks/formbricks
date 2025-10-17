import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { extractRecallInfo } from "@/lib/utils/recall";
import { findHiddenFieldUsedInLogic, isUsedInQuota, isUsedInRecall } from "@/modules/survey/editor/lib/utils";
import { HiddenFieldsCard } from "./hidden-fields-card";

// Mock the Tag component to avoid rendering its internal logic
vi.mock("@/modules/ui/components/tag", () => ({
  Tag: ({ tagName, onDelete }: { tagName: string; onDelete: (fieldId: string) => void }) => (
    <div>
      {tagName}
      <button onClick={() => onDelete(tagName)} aria-label={`Delete ${tagName}`}>
        Delete
      </button>
    </div>
  ),
}));

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock @formkit/auto-animate - simplify implementation
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

// Mock the recall utility functions
vi.mock("@/lib/utils/recall", () => ({
  extractRecallInfo: vi.fn(),
}));

vi.mock("@/modules/survey/editor/lib/utils", () => ({
  findHiddenFieldUsedInLogic: vi.fn(),
  isUsedInQuota: vi.fn(),
  isUsedInRecall: vi.fn(),
}));

describe("HiddenFieldsCard", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("should render all hidden fields when localSurvey.hiddenFields.fieldIds is populated", () => {
    const hiddenFields = ["field1", "field2", "field3"];
    const localSurvey = {
      id: "survey1",
      name: "Test Survey",
      welcomeCard: { enabled: false, headline: {} } as unknown as TSurvey["welcomeCard"],
      questions: [],
      endings: [],
      hiddenFields: {
        enabled: true,
        fieldIds: hiddenFields,
      },
      type: "link",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      languages: [],
    } as unknown as TSurvey;

    render(
      <HiddenFieldsCard
        localSurvey={localSurvey}
        setLocalSurvey={vi.fn()}
        activeQuestionId={"hidden"}
        setActiveQuestionId={vi.fn()}
        quotas={[]}
      />
    );

    hiddenFields.forEach((fieldId) => {
      expect(screen.getByText(fieldId)).toBeInTheDocument();
    });
  });

  test("should display a message indicating no hidden fields when localSurvey.hiddenFields.fieldIds is empty", () => {
    const localSurvey = {
      id: "survey1",
      name: "Test Survey",
      welcomeCard: { enabled: false, headline: {} } as unknown as TSurvey["welcomeCard"],
      questions: [],
      endings: [],
      hiddenFields: {
        enabled: true,
        fieldIds: [],
      },
      type: "link",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      languages: [],
    } as unknown as TSurvey;

    render(
      <HiddenFieldsCard
        localSurvey={localSurvey}
        setLocalSurvey={vi.fn()}
        activeQuestionId={"hidden"}
        setActiveQuestionId={vi.fn()}
        quotas={[]}
      />
    );

    expect(
      screen.getByText("environments.surveys.edit.no_hidden_fields_yet_add_first_one_below")
    ).toBeInTheDocument();
  });

  test("should add a new hidden field when the form is submitted with a valid ID", async () => {
    const localSurvey = {
      id: "survey1",
      name: "Test Survey",
      welcomeCard: { enabled: false, headline: {} } as unknown as TSurvey["welcomeCard"],
      questions: [],
      endings: [],
      hiddenFields: {
        enabled: true,
        fieldIds: [],
      },
      type: "link",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      languages: [],
    } as unknown as TSurvey;

    const setLocalSurvey = vi.fn();

    render(
      <HiddenFieldsCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        activeQuestionId={"hidden"}
        setActiveQuestionId={vi.fn()}
        quotas={[]}
      />
    );

    const inputElement = screen.getByRole("textbox");
    const addButton = screen.getByText("environments.surveys.edit.add_hidden_field_id");

    await userEvent.type(inputElement, "newFieldId");
    await userEvent.click(addButton);

    expect(setLocalSurvey).toHaveBeenCalledTimes(1);
    expect(setLocalSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        hiddenFields: expect.objectContaining({
          fieldIds: ["newFieldId"],
        }),
      })
    );
  });

  test("should display an error toast and prevent adding a hidden field with an existing question ID", async () => {
    const existingQuestionId = "question1";
    const localSurvey = {
      id: "survey1",
      name: "Test Survey",
      welcomeCard: { enabled: false, headline: {} } as unknown as TSurvey["welcomeCard"],
      questions: [{ id: existingQuestionId, headline: { en: "Question 1" }, type: "shortText" }],
      endings: [],
      hiddenFields: {
        enabled: true,
        fieldIds: [],
      },
      type: "link",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      languages: [],
    } as unknown as TSurvey;

    const setLocalSurveyMock = vi.fn();
    const toastErrorSpy = vi.mocked(toast.error);
    toastErrorSpy.mockClear();

    render(
      <HiddenFieldsCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurveyMock}
        activeQuestionId={"hidden"}
        setActiveQuestionId={vi.fn()}
        quotas={[]}
      />
    );

    // Open the collapsible
    const collapsibleTrigger = screen.getByText("common.hidden_fields").closest('div[type="button"]');
    if (!collapsibleTrigger) throw new Error("Could not find collapsible trigger");
    await userEvent.click(collapsibleTrigger);

    const inputElement = screen.getByLabelText("common.hidden_field");
    fireEvent.change(inputElement, { target: { value: existingQuestionId } });

    const addButton = screen.getByRole("button", { name: "environments.surveys.edit.add_hidden_field_id" });
    fireEvent.submit(addButton);

    expect(toastErrorSpy).toHaveBeenCalled();
    expect(setLocalSurveyMock).not.toHaveBeenCalled();
  });

  describe("Recall Functionality", () => {
    const createMockSurveyWithRecall = (fieldId: string) =>
      ({
        id: "survey1",
        name: "Test Survey",
        welcomeCard: { enabled: false, headline: {} } as unknown as TSurvey["welcomeCard"],
        questions: [
          {
            id: "question1",
            headline: { en: `Question with #recall:${fieldId}/fallback:default#` },
            type: "shortText",
          },
        ],
        endings: [],
        hiddenFields: {
          enabled: true,
          fieldIds: [fieldId],
        },
        followUps: [],
        type: "link",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        languages: [],
      }) as unknown as TSurvey;

    test("should remove recall info from question headlines when deleting hidden field", () => {
      const fieldId = "testField";
      const localSurvey = createMockSurveyWithRecall(fieldId);
      const setLocalSurvey = vi.fn();

      // Mock extractRecallInfo to return the recall pattern
      vi.mocked(extractRecallInfo).mockReturnValue(`#recall:${fieldId}/fallback:default#`);

      // Mock the utility functions to allow deletion
      vi.mocked(findHiddenFieldUsedInLogic).mockReturnValue(-1);
      vi.mocked(isUsedInRecall).mockReturnValue(-1);
      vi.mocked(isUsedInQuota).mockReturnValue(false);

      render(
        <HiddenFieldsCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          activeQuestionId={"hidden"}
          setActiveQuestionId={vi.fn()}
          quotas={[]}
        />
      );

      // Find and click the delete button for the hidden field
      const deleteButton = screen.getByLabelText(`Delete ${fieldId}`);
      fireEvent.click(deleteButton);

      expect(setLocalSurvey).toHaveBeenCalledWith(
        expect.objectContaining({
          questions: expect.arrayContaining([
            expect.objectContaining({
              headline: { en: "Question with " }, // Recall info should be removed
            }),
          ]),
          hiddenFields: expect.objectContaining({
            fieldIds: [], // Field should be removed
          }),
        })
      );
    });

    test("should prevent deletion when hidden field is used in recall in welcome card", () => {
      const fieldId = "testField";
      const localSurvey = createMockSurveyWithRecall(fieldId);
      const setLocalSurvey = vi.fn();
      const toastErrorSpy = vi.mocked(toast.error);

      // Mock findHiddenFieldUsedInLogic to return -1 (not found in logic)
      vi.mocked(findHiddenFieldUsedInLogic).mockReturnValue(-1);
      // Mock isUsedInRecall to return -2 (welcome card)
      vi.mocked(isUsedInRecall).mockReturnValue(-2);

      render(
        <HiddenFieldsCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          activeQuestionId={"hidden"}
          setActiveQuestionId={vi.fn()}
          quotas={[]}
        />
      );

      // Find and click the delete button for the hidden field
      const deleteButton = screen.getByLabelText(`Delete ${fieldId}`);
      fireEvent.click(deleteButton);

      expect(toastErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("environments.surveys.edit.hidden_field_used_in_recall_welcome")
      );
      expect(setLocalSurvey).not.toHaveBeenCalled();
    });

    test("should prevent deletion when hidden field is used in recall in ending card", () => {
      const fieldId = "testField";
      const localSurvey = createMockSurveyWithRecall(fieldId);
      const setLocalSurvey = vi.fn();
      const toastErrorSpy = vi.mocked(toast.error);

      // Mock findHiddenFieldUsedInLogic to return -1 (not found in logic)
      vi.mocked(findHiddenFieldUsedInLogic).mockReturnValue(-1);
      // Mock isUsedInRecall to return questions.length (ending card)
      vi.mocked(isUsedInRecall).mockReturnValue(localSurvey.questions.length);

      render(
        <HiddenFieldsCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          activeQuestionId={"hidden"}
          setActiveQuestionId={vi.fn()}
          quotas={[]}
        />
      );

      // Find and click the delete button for the hidden field
      const deleteButton = screen.getByLabelText(`Delete ${fieldId}`);
      fireEvent.click(deleteButton);

      expect(toastErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("environments.surveys.edit.hidden_field_used_in_recall_ending_card")
      );
      expect(setLocalSurvey).not.toHaveBeenCalled();
    });

    test("should prevent deletion when hidden field is used in recall in question", () => {
      const fieldId = "testField";
      const localSurvey = createMockSurveyWithRecall(fieldId);
      const setLocalSurvey = vi.fn();
      const toastErrorSpy = vi.mocked(toast.error);

      // Mock findHiddenFieldUsedInLogic to return -1 (not found in logic)
      vi.mocked(findHiddenFieldUsedInLogic).mockReturnValue(-1);
      // Mock isUsedInRecall to return question index
      vi.mocked(isUsedInRecall).mockReturnValue(0);

      render(
        <HiddenFieldsCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          activeQuestionId={"hidden"}
          setActiveQuestionId={vi.fn()}
          quotas={[]}
        />
      );

      // Find and click the delete button for the hidden field
      const deleteButton = screen.getByLabelText(`Delete ${fieldId}`);
      fireEvent.click(deleteButton);

      expect(toastErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("environments.surveys.edit.hidden_field_used_in_recall")
      );
      expect(setLocalSurvey).not.toHaveBeenCalled();
    });

    test("should handle multiple language codes when removing recall info", () => {
      const fieldId = "testField";
      const localSurvey = {
        id: "survey1",
        name: "Test Survey",
        welcomeCard: { enabled: false, headline: {} } as unknown as TSurvey["welcomeCard"],
        questions: [
          {
            id: "question1",
            headline: {
              en: `Question with #recall:${fieldId}/fallback:default#`,
              es: `Pregunta con #recall:${fieldId}/fallback:default#`,
            },
            type: "shortText",
          },
        ],
        endings: [],
        hiddenFields: {
          enabled: true,
          fieldIds: [fieldId],
        },
        followUps: [],
        type: "link",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        languages: [],
      } as unknown as TSurvey;

      const setLocalSurvey = vi.fn();

      // Mock extractRecallInfo to return the recall pattern
      vi.mocked(extractRecallInfo).mockReturnValue(`#recall:${fieldId}/fallback:default#`);

      render(
        <HiddenFieldsCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          activeQuestionId={"hidden"}
          setActiveQuestionId={vi.fn()}
          quotas={[]}
        />
      );

      // Mock the utility functions to allow deletion
      vi.mocked(findHiddenFieldUsedInLogic).mockReturnValue(-1);
      vi.mocked(isUsedInRecall).mockReturnValue(-1);
      vi.mocked(isUsedInQuota).mockReturnValue(false);

      // Find and click the delete button for the hidden field
      const deleteButton = screen.getByLabelText(`Delete ${fieldId}`);
      fireEvent.click(deleteButton);

      expect(setLocalSurvey).toHaveBeenCalledWith(
        expect.objectContaining({
          questions: expect.arrayContaining([
            expect.objectContaining({
              headline: {
                en: "Question with ",
                es: "Pregunta con ",
              }, // Recall info should be removed from both languages
            }),
          ]),
        })
      );
    });

    test("should not remove recall info when extractRecallInfo returns null", () => {
      const fieldId = "testField";
      const localSurvey = createMockSurveyWithRecall(fieldId);
      const setLocalSurvey = vi.fn();

      // Mock extractRecallInfo to return null
      vi.mocked(extractRecallInfo).mockReturnValue(null);

      render(
        <HiddenFieldsCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          activeQuestionId={"hidden"}
          setActiveQuestionId={vi.fn()}
          quotas={[]}
        />
      );

      // Mock the utility functions to allow deletion
      vi.mocked(findHiddenFieldUsedInLogic).mockReturnValue(-1);
      vi.mocked(isUsedInRecall).mockReturnValue(-1);
      vi.mocked(isUsedInQuota).mockReturnValue(false);

      // Find and click the delete button for the hidden field
      const deleteButton = screen.getByLabelText(`Delete ${fieldId}`);
      fireEvent.click(deleteButton);

      expect(setLocalSurvey).toHaveBeenCalledWith(
        expect.objectContaining({
          questions: expect.arrayContaining([
            expect.objectContaining({
              headline: { en: `Question with #recall:${fieldId}/fallback:default#` }, // Recall info should remain
            }),
          ]),
        })
      );
    });

    test("should handle deletion when hidden field is not used in recall", () => {
      const fieldId = "testField";
      const localSurvey = createMockSurveyWithRecall(fieldId);
      const setLocalSurvey = vi.fn();

      // Mock findHiddenFieldUsedInLogic to return -1 (not found in logic)
      vi.mocked(findHiddenFieldUsedInLogic).mockReturnValue(-1);
      // Mock isUsedInRecall to return -1 (not found)
      vi.mocked(isUsedInRecall).mockReturnValue(-1);
      // Mock isUsedInQuota to return false (not used in quota)
      vi.mocked(isUsedInQuota).mockReturnValue(false);

      render(
        <HiddenFieldsCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          activeQuestionId={"hidden"}
          setActiveQuestionId={vi.fn()}
          quotas={[]}
        />
      );

      // Find and click the delete button for the hidden field
      const deleteButton = screen.getByLabelText(`Delete ${fieldId}`);
      fireEvent.click(deleteButton);

      expect(setLocalSurvey).toHaveBeenCalledWith(
        expect.objectContaining({
          hiddenFields: expect.objectContaining({
            fieldIds: [], // Field should be removed
          }),
        })
      );
    });
  });
});
