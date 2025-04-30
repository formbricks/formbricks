import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TLanguage } from "@formbricks/types/project";
import {
  TSurvey,
  TSurveyAddressQuestion,
  TSurveyLanguage,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { AddressQuestionForm } from "./address-question-form";

vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: ({ id, label, value }: { id: string; label: string; value: any }) => (
    <input data-testid={id} aria-label={label} value={value?.default ?? value} />
  ),
}));

vi.mock("@/modules/ui/components/question-toggle-table", () => ({
  QuestionToggleTable: ({ fields }: { fields: any[] }) => (
    <div data-testid="question-toggle-table">
      {fields?.map((field) => (
        <div key={field.id} data-testid={`field-${field.id}`}>
          {field.label}
        </div>
      ))}
    </div>
  ),
}));

// Mock window.matchMedia - required for useAutoAnimate
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Mock @formkit/auto-animate - simplify implementation
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

describe("AddressQuestionForm", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the headline input field with the correct label and value", () => {
    const question: TSurveyAddressQuestion = {
      id: "1",
      type: TSurveyQuestionTypeEnum.Address,
      headline: { default: "Test Headline" },
      addressLine1: { show: true, required: false, placeholder: { default: "" } },
      addressLine2: { show: true, required: false, placeholder: { default: "" } },
      city: { show: true, required: false, placeholder: { default: "" } },
      state: { show: true, required: false, placeholder: { default: "" } },
      zip: { show: true, required: false, placeholder: { default: "" } },
      country: { show: true, required: false, placeholder: { default: "" } },
      required: false,
    };

    const localSurvey = {
      id: "survey1",
      name: "Test Survey",
      languages: [
        {
          language: { code: "default" } as unknown as TLanguage,
          default: true,
        } as unknown as TSurveyLanguage,
      ],
      questions: [question],
      environmentId: "env1",
      welcomeCard: {
        headline: {
          default: "",
        },
      } as unknown as TSurvey["welcomeCard"],
      endings: [],
    } as unknown as TSurvey;

    const updateQuestion = vi.fn();
    const setSelectedLanguageCode = vi.fn();
    const locale = "en-US";

    render(
      <AddressQuestionForm
        question={question}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        localSurvey={localSurvey}
        selectedLanguageCode="default"
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
        lastQuestion={false}
      />
    );

    const headlineInput = screen.getByLabelText("environments.surveys.edit.question*");
    expect(headlineInput).toBeInTheDocument();
    expect((headlineInput as HTMLInputElement).value).toBe("Test Headline");
  });

  test("renders the QuestionToggleTable with the correct fields", () => {
    const question: TSurveyAddressQuestion = {
      id: "1",
      type: TSurveyQuestionTypeEnum.Address,
      headline: { default: "Test Headline" },
      addressLine1: { show: true, required: false, placeholder: { default: "" } },
      addressLine2: { show: true, required: false, placeholder: { default: "" } },
      city: { show: true, required: false, placeholder: { default: "" } },
      state: { show: true, required: false, placeholder: { default: "" } },
      zip: { show: true, required: false, placeholder: { default: "" } },
      country: { show: true, required: false, placeholder: { default: "" } },
      required: false,
    };

    const localSurvey = {
      id: "survey1",
      name: "Test Survey",
      languages: [
        {
          language: { code: "default" } as unknown as TLanguage,
          default: true,
        } as unknown as TSurveyLanguage,
      ],
      questions: [question],
      environmentId: "env1",
      welcomeCard: {
        headline: {
          default: "",
        },
      } as unknown as TSurvey["welcomeCard"],
      endings: [],
    } as unknown as TSurvey;

    const updateQuestion = vi.fn();
    const setSelectedLanguageCode = vi.fn();
    const locale = "en-US";

    render(
      <AddressQuestionForm
        question={question}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        localSurvey={localSurvey}
        selectedLanguageCode="default"
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
        lastQuestion={false}
      />
    );

    const questionToggleTable = screen.getByTestId("question-toggle-table");
    expect(questionToggleTable).toBeInTheDocument();

    expect(screen.getByTestId("field-addressLine1")).toHaveTextContent(
      "environments.surveys.edit.address_line_1"
    );
    expect(screen.getByTestId("field-addressLine2")).toHaveTextContent(
      "environments.surveys.edit.address_line_2"
    );
    expect(screen.getByTestId("field-city")).toHaveTextContent("environments.surveys.edit.city");
    expect(screen.getByTestId("field-state")).toHaveTextContent("environments.surveys.edit.state");
    expect(screen.getByTestId("field-zip")).toHaveTextContent("environments.surveys.edit.zip");
    expect(screen.getByTestId("field-country")).toHaveTextContent("environments.surveys.edit.country");
  });

  test("updates the required property of the question object based on address fields visibility and requirement status", () => {
    const question: TSurveyAddressQuestion = {
      id: "1",
      type: TSurveyQuestionTypeEnum.Address,
      headline: { default: "Test Headline" },
      addressLine1: { show: true, required: false, placeholder: { default: "" } },
      addressLine2: { show: true, required: false, placeholder: { default: "" } },
      city: { show: true, required: false, placeholder: { default: "" } },
      state: { show: true, required: false, placeholder: { default: "" } },
      zip: { show: true, required: false, placeholder: { default: "" } },
      country: { show: true, required: false, placeholder: { default: "" } },
      required: true,
    };

    const localSurvey = {
      id: "survey1",
      name: "Test Survey",
      languages: [
        {
          language: { code: "default" } as unknown as TLanguage,
          default: true,
        } as unknown as TSurveyLanguage,
      ],
      questions: [question],
      environmentId: "env1",
      welcomeCard: {
        headline: {
          default: "",
        },
      } as unknown as TSurvey["welcomeCard"],
      endings: [],
    } as unknown as TSurvey;

    const updateQuestion = vi.fn();
    const setSelectedLanguageCode = vi.fn();
    const locale = "en-US";

    render(
      <AddressQuestionForm
        question={question}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        localSurvey={localSurvey}
        selectedLanguageCode="default"
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
        lastQuestion={false}
      />
    );

    expect(updateQuestion).toHaveBeenCalledWith(0, { required: false });
  });

  test("updates required property when questionIdx changes", () => {
    const question: TSurveyAddressQuestion = {
      id: "1",
      type: TSurveyQuestionTypeEnum.Address,
      headline: { default: "Test Headline" },
      addressLine1: { show: true, required: false, placeholder: { default: "" } },
      addressLine2: { show: true, required: false, placeholder: { default: "" } },
      city: { show: true, required: false, placeholder: { default: "" } },
      state: { show: true, required: false, placeholder: { default: "" } },
      zip: { show: true, required: false, placeholder: { default: "" } },
      country: { show: true, required: false, placeholder: { default: "" } },
      required: false,
    };

    const localSurvey = {
      id: "survey1",
      name: "Test Survey",
      languages: [
        {
          language: { code: "default" } as unknown as TLanguage,
          default: true,
        } as unknown as TSurveyLanguage,
      ],
      questions: [question],
      environmentId: "env1",
      welcomeCard: {
        headline: {
          default: "",
        },
      } as unknown as TSurvey["welcomeCard"],
      endings: [],
    } as unknown as TSurvey;

    const updateQuestion = vi.fn();
    const setSelectedLanguageCode = vi.fn();
    const locale = "en-US";

    const { rerender } = render(
      <AddressQuestionForm
        question={question}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        localSurvey={localSurvey}
        selectedLanguageCode="default"
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
        lastQuestion={false}
      />
    );

    const updatedQuestion: TSurveyAddressQuestion = {
      ...question,
      addressLine1: { ...question.addressLine1, required: true },
    };

    rerender(
      <AddressQuestionForm
        question={updatedQuestion}
        questionIdx={1}
        updateQuestion={updateQuestion}
        isInvalid={false}
        localSurvey={localSurvey}
        selectedLanguageCode="default"
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
        lastQuestion={false}
      />
    );

    expect(updateQuestion).toHaveBeenCalledTimes(2);
    expect(updateQuestion).toHaveBeenNthCalledWith(1, 0, { required: false });
    expect(updateQuestion).toHaveBeenNthCalledWith(2, 1, { required: true });
  });

  test("clicking 'Add Description' button with empty languages array should create a valid i18n string", async () => {
    const question: TSurveyAddressQuestion = {
      id: "1",
      type: TSurveyQuestionTypeEnum.Address,
      headline: { default: "Test Headline" },
      addressLine1: { show: true, required: false, placeholder: { default: "" } },
      addressLine2: { show: true, required: false, placeholder: { default: "" } },
      city: { show: true, required: false, placeholder: { default: "" } },
      state: { show: true, required: false, placeholder: { default: "" } },
      zip: { show: true, required: false, placeholder: { default: "" } },
      country: { show: true, required: false, placeholder: { default: "" } },
      required: false,
    };

    const localSurvey = {
      id: "survey1",
      name: "Test Survey",
      languages: [],
      questions: [question],
      environmentId: "env1",
      welcomeCard: {
        headline: {
          default: "",
        },
      } as unknown as TSurvey["welcomeCard"],
      endings: [],
    } as unknown as TSurvey;

    const updateQuestion = vi.fn();
    const setSelectedLanguageCode = vi.fn();
    const locale = "en-US";

    render(
      <AddressQuestionForm
        question={question}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        localSurvey={localSurvey}
        selectedLanguageCode="default"
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
        lastQuestion={false}
      />
    );

    const addButton = screen.getByText("environments.surveys.edit.add_description");
    expect(addButton).toBeInTheDocument();

    await userEvent.click(addButton);

    expect(updateQuestion).toHaveBeenCalledWith(0, { subheader: { default: "" } });
  });

  test("should prevent setting the overall question to non-required when all visible address fields are required", () => {
    const question: TSurveyAddressQuestion = {
      id: "1",
      type: TSurveyQuestionTypeEnum.Address,
      headline: { default: "Test Headline" },
      addressLine1: { show: true, required: true, placeholder: { default: "" } },
      addressLine2: { show: true, required: true, placeholder: { default: "" } },
      city: { show: true, required: true, placeholder: { default: "" } },
      state: { show: true, required: true, placeholder: { default: "" } },
      zip: { show: true, required: true, placeholder: { default: "" } },
      country: { show: true, required: true, placeholder: { default: "" } },
      required: false,
    };

    const localSurvey = {
      id: "survey1",
      name: "Test Survey",
      languages: [
        {
          language: { code: "default" } as unknown as TLanguage,
          default: true,
        } as unknown as TSurveyLanguage,
      ],
      questions: [question],
      environmentId: "env1",
      welcomeCard: {
        headline: {
          default: "",
        },
      } as unknown as TSurvey["welcomeCard"],
      endings: [],
    } as unknown as TSurvey;

    const updateQuestion = vi.fn();
    const setSelectedLanguageCode = vi.fn();
    const locale = "en-US";

    render(
      <AddressQuestionForm
        question={question}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        localSurvey={localSurvey}
        selectedLanguageCode="default"
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
        lastQuestion={false}
      />
    );

    expect(updateQuestion).toHaveBeenCalledWith(0, { required: true });
  });
});
