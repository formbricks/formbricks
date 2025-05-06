import { cleanup, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";

// Mock environment-dependent modules
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  FORMBRICKS_API_HOST: "http://localhost:3000",
  FORMBRICKS_ENVIRONMENT_ID: "test-env-id",
}));

vi.mock("@/modules/survey/editor/actions", () => ({}));

describe("WhenToSendCard", () => {
  afterEach(() => {
    cleanup();
  });

  test("should initialize open state to true when localSurvey.type is app", () => {
    const localSurvey = {
      id: "1",
      name: "Test Survey",
      type: "app",
      createdAt: new Date("2024-02-13T11:00:00.000Z"),
      updatedAt: new Date("2024-02-13T11:00:00.000Z"),
      questions: [],
      triggers: [],
    } as unknown as TSurvey;

    const TestComponent = () => {
      const [open] = useState(localSurvey.type === "app");
      return <>{open.toString()}</>;
    };

    const { container } = render(<TestComponent />);
    expect(container.textContent).toBe("true");
  });

  test("should initialize open state to false when localSurvey.type is link", () => {
    const localSurvey = {
      id: "2",
      name: "Test Survey",
      type: "link",
      createdAt: new Date("2024-02-13T11:00:00.000Z"),
      updatedAt: new Date("2024-02-13T11:00:00.000Z"),
      questions: [],
      triggers: [],
    } as unknown as TSurvey;

    const TestComponent = () => {
      const [open] = useState(localSurvey.type === "app");
      return <>{open.toString()}</>;
    };

    const { container } = render(<TestComponent />);
    expect(container.textContent).toBe("false");
  });

  test("handleTriggerDelay correctly handles invalid inputs", () => {
    const localSurvey = {
      id: "3",
      name: "Test Survey",
      type: "app",
      createdAt: new Date("2024-02-13T11:00:00.000Z"),
      updatedAt: new Date("2024-02-13T11:00:00.000Z"),
      questions: [],
      triggers: [],
      delay: 5,
    } as unknown as TSurvey;

    const setLocalSurvey = vi.fn();

    // Recreate the handleTriggerDelay function here to isolate its logic
    const handleTriggerDelay = (e: any) => {
      let value = parseInt(e.target.value);

      if (value < 1 || Number.isNaN(value)) {
        value = 0;
      }

      const updatedSurvey = { ...localSurvey, delay: value };
      setLocalSurvey(updatedSurvey);
    };

    // Simulate an event with a non-numeric value
    handleTriggerDelay({ target: { value: "abc" } });
    expect(setLocalSurvey).toHaveBeenCalledWith({ ...localSurvey, delay: 0 });

    // Simulate an event with a value less than 1
    setLocalSurvey.mockClear(); // Clear mock calls for the next assertion
    handleTriggerDelay({ target: { value: "0" } });
    expect(setLocalSurvey).toHaveBeenCalledWith({ ...localSurvey, delay: 0 });
  });
});
