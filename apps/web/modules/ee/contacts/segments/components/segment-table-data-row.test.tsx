import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format, formatDistanceToNow } from "date-fns";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegmentWithSurveyNames } from "@formbricks/types/segment";
import { EditSegmentModal } from "./edit-segment-modal";
import { SegmentTableDataRow } from "./segment-table-data-row";

vi.mock("./edit-segment-modal", () => ({
  EditSegmentModal: vi.fn(() => null),
}));

const mockCurrentSegment = {
  id: "seg1",
  title: "Test Segment",
  description: "This is a test segment",
  isPrivate: false,
  filters: [],
  environmentId: "env1",
  surveys: ["survey1", "survey2"],
  createdAt: new Date("2023-01-15T10:00:00.000Z"),
  updatedAt: new Date("2023-01-20T12:00:00.000Z"),
} as unknown as TSegmentWithSurveyNames;

const mockSegments = [mockCurrentSegment];
const mockContactAttributeKeys = [{ key: "email", label: "Email" } as unknown as TContactAttributeKey];
const mockIsContactsEnabled = true;
const mockIsReadOnly = false;

describe("SegmentTableDataRow", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders segment data correctly", () => {
    render(
      <SegmentTableDataRow
        currentSegment={mockCurrentSegment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        isContactsEnabled={mockIsContactsEnabled}
        isReadOnly={mockIsReadOnly}
      />
    );

    expect(screen.getByText(mockCurrentSegment.title)).toBeInTheDocument();
    expect(screen.getByText(mockCurrentSegment.description!)).toBeInTheDocument();
    expect(screen.getByText(mockCurrentSegment.surveys.length.toString())).toBeInTheDocument();
    expect(
      screen.getByText(
        formatDistanceToNow(mockCurrentSegment.updatedAt, {
          addSuffix: true,
        }).replace("about", "")
      )
    ).toBeInTheDocument();
    expect(screen.getByText(format(mockCurrentSegment.createdAt, "do 'of' MMMM, yyyy"))).toBeInTheDocument();
  });

  test("opens EditSegmentModal when row is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SegmentTableDataRow
        currentSegment={mockCurrentSegment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        isContactsEnabled={mockIsContactsEnabled}
        isReadOnly={mockIsReadOnly}
      />
    );

    const row = screen.getByText(mockCurrentSegment.title).closest("div.grid");
    expect(row).toBeInTheDocument();

    // Initially modal should not be called with open: true
    expect(vi.mocked(EditSegmentModal)).toHaveBeenCalledWith(
      expect.objectContaining({ open: false }),
      undefined // Expect undefined as the second argument
    );

    await user.click(row!);

    // After click, modal should be called with open: true
    expect(vi.mocked(EditSegmentModal)).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        currentSegment: mockCurrentSegment,
        environmentId: mockCurrentSegment.environmentId,
        segments: mockSegments,
        contactAttributeKeys: mockContactAttributeKeys,
        isContactsEnabled: mockIsContactsEnabled,
        isReadOnly: mockIsReadOnly,
      }),
      undefined // Expect undefined as the second argument
    );
  });

  test("passes isReadOnly prop correctly to EditSegmentModal", async () => {
    const user = userEvent.setup();
    render(
      <SegmentTableDataRow
        currentSegment={mockCurrentSegment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        isContactsEnabled={mockIsContactsEnabled}
        isReadOnly={true} // Set isReadOnly to true
      />
    );

    // Check initial call (open: false)
    expect(vi.mocked(EditSegmentModal)).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        open: false,
        isReadOnly: true,
      }),
      undefined // Expect undefined as the second argument
    );

    const row = screen.getByText(mockCurrentSegment.title).closest("div.grid");
    await user.click(row!);

    // Check second call (open: true)
    expect(vi.mocked(EditSegmentModal)).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        open: true,
        isReadOnly: true,
      }),
      undefined // Expect undefined as the second argument
    );
  });
});
