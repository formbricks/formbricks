import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { HiddenFieldsCard } from "./hidden-fields-card";

// Mock the Tag component to avoid rendering its internal logic
vi.mock("@/modules/ui/components/tag", () => ({
  Tag: ({ tagName }: { tagName: string }) => <div>{tagName}</div>,
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

describe("HiddenFieldsCard", () => {
  afterEach(() => {
    cleanup();
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
});
