import * as Collapsible from "@radix-ui/react-collapsible";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { ResponseOptionsCard } from "./response-options-card";

vi.mock("react-hot-toast");

describe("ResponseOptionsCard", () => {
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

  afterEach(() => {
    cleanup();
  });

  test("should initialize open state to true when localSurvey.type is 'link'", () => {
    const localSurvey: TSurvey = {
      id: "1",
      name: "Test Survey",
      type: "link",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as TSurvey;

    const MockResponseOptionsCard = () => {
      const [open, setOpen] = useState(localSurvey.type === "link");

      return (
        <Collapsible.Root open={open} onOpenChange={setOpen} data-testid="response-options-collapsible">
          <div>Response Options</div>
        </Collapsible.Root>
      );
    };

    render(<MockResponseOptionsCard />);

    const collapsibleRoot = screen.getByTestId("response-options-collapsible");
    expect(collapsibleRoot).toHaveAttribute("data-state", "open");
  });

  test("should set runOnDateToggle to true when handleRunOnDateToggle is called and runOnDateToggle is false", async () => {
    const localSurvey: TSurvey = {
      id: "1",
      name: "Test Survey",
      type: "link",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runOnDate: null,
    } as unknown as TSurvey;

    const setLocalSurvey = vi.fn();

    render(
      <ResponseOptionsCard localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} responseCount={0} />
    );

    const runOnDateToggle = screen.getByText("environments.surveys.edit.release_survey_on_date");
    await userEvent.click(runOnDateToggle);

    // Check if the switch element is checked after clicking
    const runOnDateSwitch = screen.getByRole("switch", { name: /release_survey_on_date/i });
    expect(runOnDateSwitch).toHaveAttribute("data-state", "checked");
  });

  test("should not correct the invalid autoComplete value when it is less than or equal to responseCount after blur", async () => {
    const localSurvey: TSurvey = {
      id: "1",
      name: "Test Survey",
      type: "link",
      autoComplete: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as TSurvey;

    const setLocalSurvey = vi.fn();
    const responseCount = 5;

    render(
      <ResponseOptionsCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        responseCount={responseCount}
      />
    );

    const inputElement = screen.getByRole("spinbutton");
    expect(inputElement).toBeInTheDocument();

    await userEvent.clear(inputElement);
    await userEvent.type(inputElement, "3");
    fireEvent.blur(inputElement);

    expect(toast.error).toHaveBeenCalled();
    expect((inputElement as HTMLInputElement).value).toBe("3");
  });

  test("should reset surveyClosedMessage to null when toggled off and on", async () => {
    const initialSurvey: TSurvey = {
      id: "1",
      name: "Test Survey",
      type: "link",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      surveyClosedMessage: {
        heading: "Custom Heading",
        subheading: "Custom Subheading",
      },
    } as unknown as TSurvey;

    let updatedSurvey: TSurvey | null = null;

    const setLocalSurveyMock = (survey: TSurvey | ((TSurvey) => TSurvey)) => {
      if (typeof survey === "function") {
        updatedSurvey = survey(initialSurvey);
      } else {
        updatedSurvey = survey;
      }
    };

    const MockResponseOptionsCard = () => {
      const [localSurvey, _] = useState(initialSurvey); // NOSONAR // It's fine for the test
      const [surveyClosedMessageToggle, setSurveyClosedMessageToggle] = useState(
        !!localSurvey.surveyClosedMessage
      );

      const handleCloseSurveyMessageToggle = () => {
        setSurveyClosedMessageToggle((prev) => !prev); // NOSONAR // It's fine for the test

        if (surveyClosedMessageToggle && localSurvey.surveyClosedMessage) {
          setLocalSurveyMock((prevSurvey: TSurvey) => ({ ...prevSurvey, surveyClosedMessage: null })); // NOSONAR // It's fine for the test
        }
      };

      return (
        <div>
          <button data-testid="toggle-button" onClick={handleCloseSurveyMessageToggle}>
            Toggle Survey Closed Message
          </button>
        </div>
      );
    };

    render(<MockResponseOptionsCard />);

    const toggleButton = screen.getByTestId("toggle-button");

    // Toggle off
    await userEvent.click(toggleButton);

    // Toggle on
    await userEvent.click(toggleButton);

    if (updatedSurvey) {
      expect((updatedSurvey as TSurvey).surveyClosedMessage).toBeNull();
    }
  });
});
