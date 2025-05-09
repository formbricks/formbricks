import { convertDateTimeStringShort } from "@/lib/time";
import { SegmentActivityTab } from "@/modules/ee/contacts/segments/components/segment-activity-tab";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSegment } from "@formbricks/types/segment";

const mockSegmentBase: TSegment & { activeSurveys: string[]; inactiveSurveys: string[] } = {
  id: "seg123",
  title: "Test Segment",
  description: "A segment for testing",
  environmentId: "env456",
  filters: [],
  isPrivate: false,
  surveys: [],
  createdAt: new Date("2024-01-01T10:00:00.000Z"),
  updatedAt: new Date("2024-01-02T11:30:00.000Z"),
  activeSurveys: [],
  inactiveSurveys: [],
};

describe("SegmentActivityTab", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders correctly with active and inactive surveys", () => {
    const segmentWithSurveys = {
      ...mockSegmentBase,
      activeSurveys: ["Active Survey 1", "Active Survey 2"],
      inactiveSurveys: ["Inactive Survey 1"],
    };
    render(<SegmentActivityTab environmentId="env456" currentSegment={segmentWithSurveys} />);

    expect(screen.getByText("common.active_surveys")).toBeInTheDocument();
    expect(screen.getByText("Active Survey 1")).toBeInTheDocument();
    expect(screen.getByText("Active Survey 2")).toBeInTheDocument();

    expect(screen.getByText("common.inactive_surveys")).toBeInTheDocument();
    expect(screen.getByText("Inactive Survey 1")).toBeInTheDocument();

    expect(screen.getByText("common.created_at")).toBeInTheDocument();
    expect(
      screen.getByText(convertDateTimeStringShort(segmentWithSurveys.createdAt.toString()))
    ).toBeInTheDocument();
    expect(screen.getByText("common.updated_at")).toBeInTheDocument();
    expect(
      screen.getByText(convertDateTimeStringShort(segmentWithSurveys.updatedAt.toString()))
    ).toBeInTheDocument();
    expect(screen.getByText("environments.segments.segment_id")).toBeInTheDocument();
    expect(screen.getByText(segmentWithSurveys.id)).toBeInTheDocument();
  });

  test("renders correctly with only active surveys", () => {
    const segmentOnlyActive = {
      ...mockSegmentBase,
      activeSurveys: ["Active Survey Only"],
      inactiveSurveys: [],
    };
    render(<SegmentActivityTab environmentId="env456" currentSegment={segmentOnlyActive} />);

    expect(screen.getByText("common.active_surveys")).toBeInTheDocument();
    expect(screen.getByText("Active Survey Only")).toBeInTheDocument();

    expect(screen.getByText("common.inactive_surveys")).toBeInTheDocument();
    // Check for the placeholder when no inactive surveys exist
    const inactiveSurveyElements = screen.queryAllByText("-");
    expect(inactiveSurveyElements.length).toBeGreaterThan(0); // Should find at least one '-'

    expect(
      screen.getByText(convertDateTimeStringShort(segmentOnlyActive.createdAt.toString()))
    ).toBeInTheDocument();
    expect(
      screen.getByText(convertDateTimeStringShort(segmentOnlyActive.updatedAt.toString()))
    ).toBeInTheDocument();
    expect(screen.getByText(segmentOnlyActive.id)).toBeInTheDocument();
  });

  test("renders correctly with only inactive surveys", () => {
    const segmentOnlyInactive = {
      ...mockSegmentBase,
      activeSurveys: [],
      inactiveSurveys: ["Inactive Survey Only"],
    };
    render(<SegmentActivityTab environmentId="env456" currentSegment={segmentOnlyInactive} />);

    expect(screen.getByText("common.active_surveys")).toBeInTheDocument();
    // Check for the placeholder when no active surveys exist
    const activeSurveyElements = screen.queryAllByText("-");
    expect(activeSurveyElements.length).toBeGreaterThan(0); // Should find at least one '-'

    expect(screen.getByText("common.inactive_surveys")).toBeInTheDocument();
    expect(screen.getByText("Inactive Survey Only")).toBeInTheDocument();

    expect(
      screen.getByText(convertDateTimeStringShort(segmentOnlyInactive.createdAt.toString()))
    ).toBeInTheDocument();
    expect(
      screen.getByText(convertDateTimeStringShort(segmentOnlyInactive.updatedAt.toString()))
    ).toBeInTheDocument();
    expect(screen.getByText(segmentOnlyInactive.id)).toBeInTheDocument();
  });

  test("renders correctly with no surveys", () => {
    const segmentNoSurveys = {
      ...mockSegmentBase,
      activeSurveys: [],
      inactiveSurveys: [],
    };
    render(<SegmentActivityTab environmentId="env456" currentSegment={segmentNoSurveys} />);

    expect(screen.getByText("common.active_surveys")).toBeInTheDocument();
    expect(screen.getByText("common.inactive_surveys")).toBeInTheDocument();

    // Check for placeholders when no surveys exist
    const placeholders = screen.queryAllByText("-");
    expect(placeholders.length).toBe(2); // Should find two '-' placeholders

    expect(
      screen.getByText(convertDateTimeStringShort(segmentNoSurveys.createdAt.toString()))
    ).toBeInTheDocument();
    expect(
      screen.getByText(convertDateTimeStringShort(segmentNoSurveys.updatedAt.toString()))
    ).toBeInTheDocument();
    expect(screen.getByText(segmentNoSurveys.id)).toBeInTheDocument();
  });
});
