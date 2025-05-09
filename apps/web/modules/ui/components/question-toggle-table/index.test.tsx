import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { QuestionToggleTable } from "./index";

// Mock the Switch component
vi.mock("@/modules/ui/components/switch", () => ({
  Switch: ({ checked, onCheckedChange, disabled }: any) => (
    <button
      data-testid={`switch-${checked ? "on" : "off"}`}
      data-disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      disabled={disabled}>
      {checked ? "On" : "Off"}
    </button>
  ),
}));

// Mock the QuestionFormInput component
vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: ({ id, value, updateQuestion, questionIdx, selectedLanguageCode }: any) => (
    <input
      data-testid={`input-${id}`}
      value={typeof value === "object" ? value[selectedLanguageCode] || "" : value}
      onChange={(e) => {
        const updatedAttributes: any = {};
        const fieldId = id.split(".")[0];
        const attributeName = id.split(".")[1];

        updatedAttributes[fieldId] = {
          show: true,
          required: false,
          placeholder: {
            [selectedLanguageCode]: e.target.value,
          },
        };

        updateQuestion(questionIdx, updatedAttributes);
      }}
    />
  ),
}));

// Mock tolgee
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

describe("QuestionToggleTable", () => {
  afterEach(() => {
    cleanup();
  });

  const mockFields = [
    {
      id: "street",
      show: true,
      required: true,
      label: "Street",
      placeholder: { default: "Enter your street" },
    },
    {
      id: "city",
      show: true,
      required: false,
      label: "City",
      placeholder: { default: "Enter your city" },
    },
  ];

  const mockSurvey: TSurvey = {
    id: "survey-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Test Survey",
    type: "web",
    environmentId: "env-1",
    status: "draft",
    questions: [
      {
        id: "question-1",
        type: "address",
        headline: "Your address",
        required: true,
        street: {
          show: true,
          required: true,
          placeholder: { default: "Street" },
        },
        city: {
          show: true,
          required: false,
          placeholder: { default: "City" },
        },
      },
    ],
    welcomeCard: {
      enabled: false,
    },
    thankYouCard: {
      enabled: false,
    },
    displayProgress: false,
    progressBar: {
      display: false,
    },
    styling: {},
    autoComplete: false,
    closeOnDate: null,
    recaptcha: {
      enabled: false,
    },
  } as unknown as TSurvey;

  test("renders address fields correctly", () => {
    const updateQuestionMock = vi.fn();

    render(
      <QuestionToggleTable
        type="address"
        fields={mockFields}
        localSurvey={mockSurvey}
        questionIdx={0}
        isInvalid={false}
        updateQuestion={updateQuestionMock}
        selectedLanguageCode="default"
        setSelectedLanguageCode={() => {}}
        locale={"en-US"}
      />
    );

    // Check table headers
    expect(screen.getByText("environments.surveys.edit.address_fields")).toBeInTheDocument();
    expect(screen.getByText("common.show")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.required")).toBeInTheDocument();
    expect(screen.getByText("common.label")).toBeInTheDocument();

    // Check field labels
    expect(screen.getByText("Street")).toBeInTheDocument();
    expect(screen.getByText("City")).toBeInTheDocument();

    // Check switches are rendered with correct state
    const streetShowSwitch = screen.getAllByTestId("switch-on")[0];
    const streetRequiredSwitch = screen.getAllByTestId("switch-on")[1];
    const cityShowSwitch = screen.getAllByTestId("switch-on")[2];
    const cityRequiredSwitch = screen.getByTestId("switch-off");

    expect(streetShowSwitch).toBeInTheDocument();
    expect(streetRequiredSwitch).toBeInTheDocument();
    expect(cityShowSwitch).toBeInTheDocument();
    expect(cityRequiredSwitch).toBeInTheDocument();

    // Check inputs are rendered
    expect(screen.getByTestId("input-street.placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("input-city.placeholder")).toBeInTheDocument();
  });

  test("renders contact fields correctly", () => {
    const updateQuestionMock = vi.fn();

    render(
      <QuestionToggleTable
        type="contact"
        fields={mockFields}
        localSurvey={mockSurvey}
        questionIdx={0}
        isInvalid={false}
        updateQuestion={updateQuestionMock}
        selectedLanguageCode="default"
        setSelectedLanguageCode={() => {}}
        locale={"en-US"}
      />
    );

    expect(screen.getByText("environments.surveys.edit.contact_fields")).toBeInTheDocument();
  });

  test("handles show toggle", async () => {
    const updateQuestionMock = vi.fn();
    const user = userEvent.setup();

    render(
      <QuestionToggleTable
        type="address"
        fields={mockFields}
        localSurvey={mockSurvey}
        questionIdx={0}
        isInvalid={false}
        updateQuestion={updateQuestionMock}
        selectedLanguageCode="default"
        setSelectedLanguageCode={() => {}}
        locale={"en-US"}
      />
    );

    // Toggle the city show switch
    const cityShowSwitch = screen.getAllByTestId("switch-on")[2];
    await user.click(cityShowSwitch);

    // Check that updateQuestion was called with correct parameters
    expect(updateQuestionMock).toHaveBeenCalledWith(0, {
      city: {
        show: false,
        required: false,
        placeholder: { default: "Enter your city" },
      },
    });
  });

  test("handles required toggle", async () => {
    const updateQuestionMock = vi.fn();
    const user = userEvent.setup();

    render(
      <QuestionToggleTable
        type="address"
        fields={mockFields}
        localSurvey={mockSurvey}
        questionIdx={0}
        isInvalid={false}
        updateQuestion={updateQuestionMock}
        selectedLanguageCode="default"
        setSelectedLanguageCode={() => {}}
        locale={"en-US"}
      />
    );

    // Toggle the city required switch
    const cityRequiredSwitch = screen.getByTestId("switch-off");
    await user.click(cityRequiredSwitch);

    // Check that updateQuestion was called with correct parameters
    expect(updateQuestionMock).toHaveBeenCalledWith(0, {
      city: {
        show: true,
        required: true,
        placeholder: { default: "Enter your city" },
      },
    });
  });

  test("disables show toggle when it's the last visible field", async () => {
    const fieldsWithOnlyOneVisible = [
      {
        id: "street",
        show: true,
        required: false,
        label: "Street",
        placeholder: { default: "Enter your street" },
      },
      {
        id: "city",
        show: false,
        required: false,
        label: "City",
        placeholder: { default: "Enter your city" },
      },
    ];

    render(
      <QuestionToggleTable
        type="address"
        fields={fieldsWithOnlyOneVisible}
        localSurvey={mockSurvey}
        questionIdx={0}
        isInvalid={false}
        updateQuestion={() => {}}
        selectedLanguageCode="default"
        setSelectedLanguageCode={() => {}}
        locale={"en-US"}
      />
    );

    // The street show toggle should be disabled
    const streetShowSwitch = screen.getByTestId("switch-on");
    expect(streetShowSwitch).toHaveAttribute("data-disabled", "true");
    expect(streetShowSwitch).toBeDisabled();
  });

  test("disables required toggle when field is not shown", async () => {
    const fieldsWithHiddenField = [
      {
        id: "street",
        show: true,
        required: false,
        label: "Street",
        placeholder: { default: "Enter your street" },
      },
      {
        id: "city",
        show: false,
        required: false,
        label: "City",
        placeholder: { default: "Enter your city" },
      },
    ];

    render(
      <QuestionToggleTable
        type="address"
        fields={fieldsWithHiddenField}
        localSurvey={mockSurvey}
        questionIdx={0}
        isInvalid={false}
        updateQuestion={() => {}}
        selectedLanguageCode="default"
        setSelectedLanguageCode={() => {}}
        locale={"en-US"}
      />
    );

    // The city required toggle should be disabled
    const requiredSwitches = screen.getAllByTestId("switch-off");
    const cityRequiredSwitch = requiredSwitches[requiredSwitches.length - 1]; // Last one should be city's required switch
    expect(cityRequiredSwitch).toHaveAttribute("data-disabled", "true");
    expect(cityRequiredSwitch).toBeDisabled();
  });
});
