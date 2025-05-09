import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment } from "@formbricks/types/segment";
import { SegmentTable } from "./segment-table";
import { SegmentTableDataRowContainer } from "./segment-table-data-row-container";

// Mock the getTranslate function
vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

// Mock the SegmentTableDataRowContainer component
vi.mock("./segment-table-data-row-container", () => ({
  SegmentTableDataRowContainer: vi.fn(({ currentSegment }) => (
    <div data-testid={`segment-row-${currentSegment.id}`}>{currentSegment.title}</div>
  )),
}));

const mockSegments = [
  {
    id: "1",
    title: "Segment 1",
    description: "Description 1",
    isPrivate: false,
    filters: [],
    surveyIds: ["survey1", "survey2"],
    createdAt: new Date(),
    updatedAt: new Date(),
    environmentId: "env1",
  },
  {
    id: "2",
    title: "Segment 2",
    description: "Description 2",
    isPrivate: true,
    filters: [],
    surveyIds: ["survey3"],
    createdAt: new Date(),
    updatedAt: new Date(),
    environmentId: "env1",
  },
] as unknown as TSegment[];

const mockContactAttributeKeys = [
  { key: "email", label: "Email" } as unknown as TContactAttributeKey,
  { key: "userId", label: "User ID" } as unknown as TContactAttributeKey,
];

describe("SegmentTable", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders table headers", async () => {
    render(
      await SegmentTable({
        segments: [],
        contactAttributeKeys: mockContactAttributeKeys,
        isContactsEnabled: true,
        isReadOnly: false,
      })
    );

    expect(screen.getByText("common.title")).toBeInTheDocument();
    expect(screen.getByText("common.surveys")).toBeInTheDocument();
    expect(screen.getByText("common.updated")).toBeInTheDocument();
    expect(screen.getByText("common.created")).toBeInTheDocument();
  });

  test('renders "create your first segment" message when no segments are provided', async () => {
    render(
      await SegmentTable({
        segments: [],
        contactAttributeKeys: mockContactAttributeKeys,
        isContactsEnabled: true,
        isReadOnly: false,
      })
    );

    expect(screen.getByText("environments.segments.create_your_first_segment")).toBeInTheDocument();
  });

  test("renders segment rows when segments are provided", async () => {
    render(
      await SegmentTable({
        segments: mockSegments,
        contactAttributeKeys: mockContactAttributeKeys,
        isContactsEnabled: true,
        isReadOnly: false,
      })
    );

    expect(screen.queryByText("environments.segments.create_your_first_segment")).not.toBeInTheDocument();
    expect(vi.mocked(SegmentTableDataRowContainer)).toHaveBeenCalledTimes(mockSegments.length);

    mockSegments.forEach((segment) => {
      expect(screen.getByTestId(`segment-row-${segment.id}`)).toBeInTheDocument();
      expect(screen.getByText(segment.title)).toBeInTheDocument();
      // Check both arguments passed to the component
      expect(vi.mocked(SegmentTableDataRowContainer)).toHaveBeenCalledWith(
        expect.objectContaining({
          currentSegment: segment,
          segments: mockSegments,
          contactAttributeKeys: mockContactAttributeKeys,
          isContactsEnabled: true,
          isReadOnly: false,
        }),
        undefined // Explicitly check for the second argument being undefined
      );
    });
  });
});
