import { cleanup, render, screen } from "@testing-library/react";
import { Unplug } from "lucide-react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { EmptyAppSurveys } from "./EmptyInAppSurveys";

vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return {
    ...actual,
    Unplug: vi.fn(() => <div data-testid="unplug-icon" />),
  };
});

const mockEnvironment = {
  id: "test-env-id",
} as unknown as TEnvironment;

describe("EmptyAppSurveys", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders correctly with translated text and icon", () => {
    render(<EmptyAppSurveys environment={mockEnvironment} />);

    expect(screen.getByTestId("unplug-icon")).toBeInTheDocument();
    expect(Unplug).toHaveBeenCalled();

    expect(screen.getByText("environments.surveys.summary.youre_not_plugged_in_yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "environments.surveys.summary.connect_your_website_or_app_with_formbricks_to_get_started"
      )
    ).toBeInTheDocument();
  });
});
