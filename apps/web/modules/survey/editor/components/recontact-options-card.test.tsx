import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTranslate } from "@tolgee/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { RecontactOptionsCard } from "./recontact-options-card";

vi.mock("@tolgee/react", () => ({
  useTranslate: vi.fn(() => ({
    t: (key: string) => key,
  })),
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
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock @formkit/auto-animate - simplify implementation
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null, {}],
}));

describe("RecontactOptionsCard", () => {
  afterEach(() => {
    cleanup();
  });

  test("should render correctly when localSurvey.type is not 'link'", () => {
    const mockSurvey: TSurvey = {
      id: "test-survey",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Survey",
      status: "draft",
      environmentId: "test-env",
      type: "app",
      responsive: true,
      welcomeCard: {
        enabled: true,
        timeToFinish: false,
        headline: { default: "Welcome" },
        buttonLabel: { default: "Start" },
        showResponseCount: false,
      },
      autoClose: null,
      closeOnDate: null,
      delay: 0,
      displayOption: "displayOnce",
      recontactDays: null,
      displayLimit: null,
      runOnDate: null,
      thankYouCard: {
        enabled: true,
        title: { default: "Thank you" },
        buttonLabel: { default: "Close" },
        buttonLink: "",
      },
      questions: [],
      endings: [],
      hiddenFields: {
        enabled: false,
        fieldIds: [],
      },
    };

    const setLocalSurvey = vi.fn();
    const environmentId = "test-env";

    render(
      <RecontactOptionsCard
        localSurvey={mockSurvey}
        setLocalSurvey={setLocalSurvey}
        environmentId={environmentId}
      />
    );

    expect(screen.getByText("environments.surveys.edit.recontact_options")).toBeVisible();
  });

  test("should not render when localSurvey.type is 'link'", () => {
    const mockSurvey: TSurvey = {
      id: "test-survey",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Survey",
      status: "draft",
      environmentId: "test-env",
      type: "link",
      responsive: true,
      welcomeCard: {
        enabled: true,
        timeToFinish: false,
        headline: { default: "Welcome" },
        buttonLabel: { default: "Start" },
        showResponseCount: false,
      },
      autoClose: null,
      closeOnDate: null,
      delay: 0,
      displayOption: "displayOnce",
      recontactDays: null,
      displayLimit: null,
      runOnDate: null,
      thankYouCard: {
        enabled: true,
        title: { default: "Thank you" },
        buttonLabel: { default: "Close" },
        buttonLink: "",
      },
      questions: [],
      endings: [],
      hiddenFields: {
        enabled: false,
        fieldIds: [],
      },
    };

    const setLocalSurvey = vi.fn();
    const environmentId = "test-env";

    const { container } = render(
      <RecontactOptionsCard
        localSurvey={mockSurvey}
        setLocalSurvey={setLocalSurvey}
        environmentId={environmentId}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  test("should update recontactDays in localSurvey when handleRecontactDaysChange is called with a valid input", async () => {
    const mockSurvey: TSurvey = {
      id: "test-survey",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Survey",
      status: "draft",
      environmentId: "test-env",
      type: "app",
      responsive: true,
      welcomeCard: {
        enabled: true,
        timeToFinish: false,
        headline: { default: "Welcome" },
        buttonLabel: { default: "Start" },
        showResponseCount: false,
      },
      autoClose: null,
      closeOnDate: null,
      delay: 0,
      displayOption: "displayOnce",
      recontactDays: 1,
      displayLimit: null,
      runOnDate: null,
      thankYouCard: {
        enabled: true,
        title: { default: "Thank you" },
        buttonLabel: { default: "Close" },
        buttonLink: "",
      },
      questions: [],
      endings: [],
      hiddenFields: {
        enabled: false,
        fieldIds: [],
      },
    };

    const setLocalSurvey = vi.fn();
    const environmentId = "test-env";

    render(
      <RecontactOptionsCard
        localSurvey={mockSurvey}
        setLocalSurvey={setLocalSurvey}
        environmentId={environmentId}
      />
    );

    const trigger = screen.getByText("environments.surveys.edit.recontact_options");
    await userEvent.click(trigger);

    const inputElement = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(inputElement, { target: { value: "5" } });

    expect(setLocalSurvey).toHaveBeenCalledTimes(1);
    expect(setLocalSurvey).toHaveBeenCalledWith({
      ...mockSurvey,
      recontactDays: 5,
    });
  });

  test("should update displayLimit in localSurvey when handleRecontactSessionDaysChange is called with a valid input", async () => {
    const mockSurvey: TSurvey = {
      id: "test-survey",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Survey",
      status: "draft",
      environmentId: "test-env",
      type: "app",
      responsive: true,
      welcomeCard: {
        enabled: true,
        timeToFinish: false,
        headline: { default: "Welcome" },
        buttonLabel: { default: "Start" },
        showResponseCount: false,
      },
      autoClose: null,
      closeOnDate: null,
      delay: 0,
      displayOption: "displaySome",
      recontactDays: null,
      displayLimit: 1,
      runOnDate: null,
      thankYouCard: {
        enabled: true,
        title: { default: "Thank you" },
        buttonLabel: { default: "Close" },
        buttonLink: "",
      },
      questions: [],
      endings: [],
      hiddenFields: {
        enabled: false,
        fieldIds: [],
      },
    };

    const setLocalSurvey = vi.fn();
    const environmentId = "test-env";

    render(
      <RecontactOptionsCard
        localSurvey={mockSurvey}
        setLocalSurvey={setLocalSurvey}
        environmentId={environmentId}
      />
    );

    const cardTrigger = screen.getByText("environments.surveys.edit.recontact_options");
    await userEvent.click(cardTrigger);

    const inputElement = screen.getByRole("spinbutton");

    await userEvent.clear(inputElement);
    await userEvent.type(inputElement, "5");

    expect(setLocalSurvey).toHaveBeenCalledTimes(2);
    expect(vi.mocked(setLocalSurvey).mock.calls[1][0]).toEqual({
      ...mockSurvey,
      displayLimit: 5,
    });
  });

  test("should update displayOption in localSurvey when a RadioGroup option is selected", async () => {
    const mockSurvey: TSurvey = {
      id: "test-survey",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Survey",
      status: "draft",
      environmentId: "test-env",
      type: "app",
      responsive: true,
      welcomeCard: {
        enabled: true,
        timeToFinish: false,
        headline: { default: "Welcome" },
        buttonLabel: { default: "Start" },
        showResponseCount: false,
      },
      autoClose: null,
      closeOnDate: null,
      delay: 0,
      displayOption: "displayOnce",
      recontactDays: null,
      displayLimit: null,
      runOnDate: null,
      thankYouCard: {
        enabled: true,
        title: { default: "Thank you" },
        buttonLabel: { default: "Close" },
        buttonLink: "",
      },
      questions: [],
      endings: [],
      hiddenFields: {
        enabled: false,
        fieldIds: [],
      },
    };

    const setLocalSurvey = vi.fn();
    const environmentId = "test-env";
    const user = userEvent.setup();

    render(
      <RecontactOptionsCard
        localSurvey={mockSurvey}
        setLocalSurvey={setLocalSurvey}
        environmentId={environmentId}
      />
    );

    // Click on the accordion trigger to open it
    const accordionTrigger = screen.getByText("environments.surveys.edit.recontact_options");
    await user.click(accordionTrigger);

    // Find the radio button for "displayMultiple" and click it
    const displayMultipleRadioButton = document.querySelector('button[value="displayMultiple"]');

    if (!displayMultipleRadioButton) {
      throw new Error("Radio button with value 'displayMultiple' not found");
    }

    await user.click(displayMultipleRadioButton);

    // Assert that setLocalSurvey is called with the updated displayOption
    expect(setLocalSurvey).toHaveBeenCalledTimes(1);
    expect(setLocalSurvey).toHaveBeenCalledWith({
      ...mockSurvey,
      displayOption: "displayMultiple",
    });
  });

  test("should initialize displayLimit when switching to 'displaySome' with undefined initial value", async () => {
    const mockSurvey: TSurvey = {
      id: "test-survey",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Survey",
      status: "draft",
      environmentId: "test-env",
      type: "app",
      responsive: true,
      welcomeCard: {
        enabled: true,
        timeToFinish: false,
        headline: { default: "Welcome" },
        buttonLabel: { default: "Start" },
        showResponseCount: false,
      },
      autoClose: null,
      closeOnDate: null,
      delay: 0,
      displayOption: "displayOnce",
      recontactDays: null,
      displayLimit: undefined, // Initial displayLimit is undefined
      runOnDate: null,
      thankYouCard: {
        enabled: true,
        title: { default: "Thank you" },
        buttonLabel: { default: "Close" },
        buttonLink: "",
      },
      questions: [],
      endings: [],
      hiddenFields: {
        enabled: false,
        fieldIds: [],
      },
    };

    const setLocalSurvey = vi.fn();
    const environmentId = "test-env";

    render(
      <RecontactOptionsCard
        localSurvey={mockSurvey}
        setLocalSurvey={setLocalSurvey}
        environmentId={environmentId}
      />
    );

    // First click the card trigger to expand the content
    const cardTrigger = document.getElementById("recontactOptionsCardTrigger");
    await userEvent.click(cardTrigger);

    const displaySomeRadio = screen.getByText("environments.surveys.edit.show_multiple_times"); // Find the 'displaySome' radio button
    await userEvent.click(displaySomeRadio);

    expect(setLocalSurvey).toHaveBeenCalledTimes(1);
    expect(setLocalSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        displayOption: "displaySome",
        displayLimit: 1,
      })
    );
  });
});
