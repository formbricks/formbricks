import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TBaseFilters, TSegment } from "@formbricks/types/segment";
import { TargetingIndicator } from "./index";

// Mock tolgee
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "environments.surveys.edit.audience": "Audience",
        "environments.surveys.edit.targeted": "Targeted",
        "environments.surveys.edit.everyone": "Everyone",
        "environments.surveys.edit.only_people_who_match_your_targeting_can_be_surveyed":
          "Only people who match your targeting can be surveyed",
        "environments.surveys.edit.without_a_filter_all_of_your_users_can_be_surveyed":
          "Without a filter all of your users can be surveyed",
      };
      return translations[key] || key;
    },
  }),
}));

describe("TargetingIndicator", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders correctly with null segment", () => {
    render(<TargetingIndicator segment={null} />);

    expect(screen.getByText("Audience:")).toBeInTheDocument();
    expect(screen.getByText("Everyone")).toBeInTheDocument();
    expect(screen.getByText("Without a filter all of your users can be surveyed")).toBeInTheDocument();

    // Should show the filter icon when no targeting
    const filterIcon = document.querySelector("svg");
    expect(filterIcon).toBeInTheDocument();
  });

  test("renders correctly with empty filters", () => {
    const emptySegment: TSegment = {
      id: "seg_123",
      environmentId: "env_123",
      title: "Test Segment",
      description: "A test segment",
      isPrivate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      filters: [],
      surveys: [],
    };

    render(<TargetingIndicator segment={emptySegment} />);

    expect(screen.getByText("Audience:")).toBeInTheDocument();
    expect(screen.getByText("Everyone")).toBeInTheDocument();
    expect(screen.getByText("Without a filter all of your users can be surveyed")).toBeInTheDocument();

    // Should show the filter icon when no targeting
    const filterIcon = document.querySelector("svg");
    expect(filterIcon).toBeInTheDocument();
  });

  test("renders correctly with filters", () => {
    const segmentWithFilters: TSegment = {
      id: "seg_123",
      environmentId: "env_123",
      title: "Test Segment",
      description: "A test segment",
      isPrivate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      filters: [
        {
          id: "filter_123",
        },
      ] as unknown as TBaseFilters,
      surveys: [],
    };

    render(<TargetingIndicator segment={segmentWithFilters} />);

    expect(screen.getByText("Audience:")).toBeInTheDocument();
    expect(screen.getByText("Targeted")).toBeInTheDocument();
    expect(screen.getByText("Only people who match your targeting can be surveyed")).toBeInTheDocument();

    // Should show the users icon when targeting is active
    const usersIcon = document.querySelector("svg");
    expect(usersIcon).toBeInTheDocument();
  });
});
