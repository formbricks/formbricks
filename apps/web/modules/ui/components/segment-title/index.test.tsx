import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SegmentTitle } from "./index";

// Mock lucide-react icon
vi.mock("lucide-react", () => ({
  UsersIcon: () => <div data-testid="users-icon" />,
}));

// Mock tolgee
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) =>
      key === "environments.surveys.edit.send_survey_to_audience_who_match"
        ? "Send survey to audience who match the following attributes:"
        : key,
  }),
}));

describe("SegmentTitle", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with title and description", () => {
    render(<SegmentTitle title="Test Segment" description="Test Description" />);

    expect(screen.getByText("Test Segment")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(screen.getByTestId("users-icon")).toBeInTheDocument();
  });

  test("renders with title and no description", () => {
    render(<SegmentTitle title="Test Segment" />);

    expect(screen.getByText("Test Segment")).toBeInTheDocument();
    expect(screen.getByTestId("users-icon")).toBeInTheDocument();
  });

  test("renders private segment text when isPrivate is true", () => {
    render(<SegmentTitle title="Test Segment" description="Test Description" isPrivate={true} />);

    expect(
      screen.getByText("Send survey to audience who match the following attributes:")
    ).toBeInTheDocument();
    expect(screen.queryByText("Test Segment")).not.toBeInTheDocument();
    expect(screen.queryByText("Test Description")).not.toBeInTheDocument();
    expect(screen.queryByTestId("users-icon")).not.toBeInTheDocument();
  });

  test("renders correctly with null description", () => {
    render(<SegmentTitle title="Test Segment" description={null} />);

    expect(screen.getByText("Test Segment")).toBeInTheDocument();
    expect(screen.getByTestId("users-icon")).toBeInTheDocument();
  });
});
