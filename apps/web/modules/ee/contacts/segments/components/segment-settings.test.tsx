import { getFormattedErrorMessage } from "@/lib/utils/helper";
import * as segmentActions from "@/modules/ee/contacts/segments/actions";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment } from "@formbricks/types/segment";
import { SegmentSettings } from "./segment-settings";

// Mock dependencies
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("@/modules/ee/contacts/segments/actions", () => ({
  updateSegmentAction: vi.fn(),
  deleteSegmentAction: vi.fn(),
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn(),
}));

describe("SegmentSettings", () => {
  const mockSetOpen = vi.fn();
  const mockEnvironmentId = "env-123";

  const mockInitialSegment = {
    id: "segment-123",
    title: "Test Segment",
    description: "Test Description",
    isPrivate: false,
    filters: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    environmentId: "env-123",
    surveys: ["survey-123"],
    activeSurveys: ["survey-123"],
    inactiveSurveys: [],
  };

  const mockSegments = [
    {
      id: "segment-456",
      title: "Another Segment",
      description: "Another Description",
      isPrivate: false,
      filters: [],
    },
  ];

  const mockContactAttributeKeys: TContactAttributeKey[] = [
    {
      id: "attr-1",
      key: "email",
      name: "Email",
      createdAt: new Date(),
      description: "Email address",
      updatedAt: new Date(),
      type: "custom",
      environmentId: "env-123",
      isUnique: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  test("updates a segment successfully when valid data is provided", async () => {
    // Mock successful response from updateSegmentAction
    const mockUpdateResponse: { data: TSegment } = {
      data: {
        id: "segment-123",
        title: "Updated Segment",
        filters: [
          {
            id: "filter-1",
            connector: null,
            resource: {
              id: "resource-1",
              qualifier: { operator: "contains" },
              root: { type: "attribute", contactAttributeKey: "email" },
              value: "hello",
            },
          },
        ],
        description: "Updated Description",
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env-123",
        surveys: ["survey-123"],
      },
    };

    vi.mocked(segmentActions.updateSegmentAction).mockResolvedValue(mockUpdateResponse);

    render(
      <SegmentSettings
        environmentId={mockEnvironmentId}
        initialSegment={mockInitialSegment}
        setOpen={mockSetOpen}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments as unknown as TSegment[]}
        isReadOnly={false}
      />
    );

    // Find and click the save button
    const saveButton = screen.getByText("common.save_changes");
    fireEvent.click(saveButton);

    // Wait for the update action to be called
    await waitFor(() => {
      expect(segmentActions.updateSegmentAction).toHaveBeenCalledWith({
        environmentId: mockEnvironmentId,
        segmentId: mockInitialSegment.id,
        data: {
          title: mockInitialSegment.title,
          description: mockInitialSegment.description,
          isPrivate: mockInitialSegment.isPrivate,
          filters: mockInitialSegment.filters,
        },
      });
    });

    // Verify success toast was shown
    expect(toast.success).toHaveBeenCalledWith("Segment updated successfully!");

    // Verify modal was closed
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  test("shows error toast when update fails", async () => {
    // Mock successful response from updateSegmentAction

    vi.mocked(segmentActions.updateSegmentAction).mockResolvedValue({
      serverError: "Failed to update segment",
    });

    vi.mocked(getFormattedErrorMessage).mockReturnValue("Failed to update segment");

    render(
      <SegmentSettings
        environmentId={mockEnvironmentId}
        initialSegment={mockInitialSegment}
        setOpen={mockSetOpen}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments as unknown as TSegment[]}
        isReadOnly={false}
      />
    );

    // Find and click the save button
    const saveButton = screen.getByText("common.save_changes");
    fireEvent.click(saveButton);

    // Wait for the update action to be called
    await waitFor(() => {
      expect(segmentActions.updateSegmentAction).toHaveBeenCalledWith({
        environmentId: mockEnvironmentId,
        segmentId: mockInitialSegment.id,
        data: {
          title: mockInitialSegment.title,
          description: mockInitialSegment.description,
          isPrivate: mockInitialSegment.isPrivate,
          filters: mockInitialSegment.filters,
        },
      });
    });

    // Verify success toast was shown
    expect(toast.error).toHaveBeenCalledWith("Failed to update segment");
  });
});
