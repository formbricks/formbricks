import * as helper from "@/lib/utils/helper";
import * as actions from "@/modules/ee/contacts/segments/actions";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SafeParseReturnType } from "zod";
import { TBaseFilters, ZSegmentFilters } from "@formbricks/types/segment";
import { SegmentSettings } from "./segment-settings";

// Mock dependencies
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/modules/ee/contacts/segments/actions", () => ({
  updateSegmentAction: vi.fn(),
  deleteSegmentAction: vi.fn(),
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn(),
}));

// Mock ZSegmentFilters validation
vi.mock("@formbricks/types/segment", () => ({
  ZSegmentFilters: {
    safeParse: vi.fn().mockReturnValue({ success: true }),
  },
}));

// Mock components used by SegmentSettings
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, loading, disabled }: any) => (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      data-loading={loading}
      data-testid={
        children === "common.save_changes"
          ? "save-button"
          : children === "common.add_filter"
            ? "add-filter-button"
            : undefined
      }>
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/input", () => ({
  Input: ({ value, onChange, disabled, placeholder }: any) => (
    <input
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      data-testid="input"
    />
  ),
}));

vi.mock("@/modules/ui/components/confirm-delete-segment-modal", () => ({
  ConfirmDeleteSegmentModal: ({ open, setOpen, onDelete }: any) =>
    open ? (
      <div data-testid="delete-modal">
        <button onClick={onDelete} data-testid="confirm-delete">
          Confirm Delete
        </button>
        <button onClick={() => setOpen(false)}>Cancel</button>
      </div>
    ) : null,
}));

vi.mock("./segment-editor", () => ({
  SegmentEditor: ({ group }) => (
    <div data-testid="segment-editor">
      Segment Editor
      <div data-testid="filter-count">{group?.length || 0}</div>
    </div>
  ),
}));

vi.mock("./add-filter-modal", () => ({
  AddFilterModal: ({ open, setOpen, onAddFilter }: any) =>
    open ? (
      <div data-testid="add-filter-modal">
        <button
          onClick={() => {
            onAddFilter({
              type: "attribute",
              attributeKey: "testKey",
              operator: "equals",
              value: "testValue",
              connector: "and",
            });
            setOpen(false); // Close the modal after adding filter
          }}
          data-testid="add-test-filter">
          Add Filter
        </button>
        <button onClick={() => setOpen(false)}>Close</button>
      </div>
    ) : null,
}));

describe("SegmentSettings", () => {
  const mockProps = {
    environmentId: "env-123",
    initialSegment: {
      id: "segment-123",
      title: "Test Segment",
      description: "Test Description",
      isPrivate: false,
      filters: [],
      activeSurveys: [],
      inactiveSurveys: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "env-123",
      surveys: [],
    },
    setOpen: vi.fn(),
    contactAttributeKeys: [],
    segments: [],
    isReadOnly: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(helper.getFormattedErrorMessage).mockReturnValue("");
    // Default to valid filters
    vi.mocked(ZSegmentFilters.safeParse).mockReturnValue({ success: true } as unknown as SafeParseReturnType<
      TBaseFilters,
      TBaseFilters
    >);
  });

  afterEach(() => {
    cleanup();
  });

  test("should update the segment and display a success message when valid data is provided", async () => {
    // Mock successful update
    vi.mocked(actions.updateSegmentAction).mockResolvedValue({
      data: {
        title: "Updated Segment",
        description: "Updated Description",
        isPrivate: false,
        filters: [],
        createdAt: new Date(),
        environmentId: "env-123",
        id: "segment-123",
        surveys: [],
        updatedAt: new Date(),
      },
    });

    // Render component
    render(<SegmentSettings {...mockProps} />);

    // Find and click the save button using data-testid
    const saveButton = screen.getByTestId("save-button");
    fireEvent.click(saveButton);

    // Verify updateSegmentAction was called with correct parameters
    await waitFor(() => {
      expect(actions.updateSegmentAction).toHaveBeenCalledWith({
        environmentId: mockProps.environmentId,
        segmentId: mockProps.initialSegment.id,
        data: {
          title: mockProps.initialSegment.title,
          description: mockProps.initialSegment.description,
          isPrivate: mockProps.initialSegment.isPrivate,
          filters: mockProps.initialSegment.filters,
        },
      });
    });

    // Verify success toast was displayed
    expect(toast.success).toHaveBeenCalledWith("Segment updated successfully!");

    // Verify state was reset and router was refreshed
    expect(mockProps.setOpen).toHaveBeenCalledWith(false);
  });

  test("should update segment title when input changes", () => {
    render(<SegmentSettings {...mockProps} />);

    // Find title input and change its value
    const titleInput = screen.getAllByTestId("input")[0];
    fireEvent.change(titleInput, { target: { value: "Updated Title" } });

    // Find and click the save button using data-testid
    const saveButton = screen.getByTestId("save-button");
    fireEvent.click(saveButton);

    // Verify updateSegmentAction was called with updated title
    expect(actions.updateSegmentAction).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Updated Title",
        }),
      })
    );
  });

  test("should reset state after successfully updating a segment", async () => {
    // Mock successful update
    vi.mocked(actions.updateSegmentAction).mockResolvedValue({
      data: {
        title: "Updated Segment",
        description: "Updated Description",
        isPrivate: false,
        filters: [],
        createdAt: new Date(),
        environmentId: "env-123",
        id: "segment-123",
        surveys: [],
        updatedAt: new Date(),
      },
    });

    // Render component
    render(<SegmentSettings {...mockProps} />);

    // Modify the segment state by changing the title
    const titleInput = screen.getAllByTestId("input")[0];
    fireEvent.change(titleInput, { target: { value: "Modified Title" } });

    // Find and click the save button
    const saveButton = screen.getByTestId("save-button");
    fireEvent.click(saveButton);

    // Wait for the update to complete
    await waitFor(() => {
      // Verify updateSegmentAction was called
      expect(actions.updateSegmentAction).toHaveBeenCalled();
    });

    // Verify success toast was displayed
    expect(toast.success).toHaveBeenCalledWith("Segment updated successfully!");

    // Verify state was reset by checking that setOpen was called with false
    expect(mockProps.setOpen).toHaveBeenCalledWith(false);

    // Re-render the component to verify it would use the initialSegment
    cleanup();
    render(<SegmentSettings {...mockProps} />);

    // Check that the title is back to the initial value
    const titleInputAfterReset = screen.getAllByTestId("input")[0];
    expect(titleInputAfterReset).toHaveValue("Test Segment");
  });

  test("should not reset state if update returns an error message", async () => {
    // Mock update with error
    vi.mocked(actions.updateSegmentAction).mockResolvedValue({});
    vi.mocked(helper.getFormattedErrorMessage).mockReturnValue("Recursive segment filter detected");

    // Render component
    render(<SegmentSettings {...mockProps} />);

    // Modify the segment state
    const titleInput = screen.getAllByTestId("input")[0];
    fireEvent.change(titleInput, { target: { value: "Modified Title" } });

    // Find and click the save button
    const saveButton = screen.getByTestId("save-button");
    fireEvent.click(saveButton);

    // Wait for the update to complete
    await waitFor(() => {
      expect(actions.updateSegmentAction).toHaveBeenCalled();
    });

    // Verify error toast was displayed
    expect(toast.error).toHaveBeenCalledWith("Recursive segment filter detected");

    // Verify state was NOT reset (setOpen should not be called)
    expect(mockProps.setOpen).not.toHaveBeenCalled();

    // Verify isUpdatingSegment was set back to false
    expect(saveButton).not.toHaveAttribute("data-loading", "true");
  });
  test("should delete the segment and display a success message when delete operation is successful", async () => {
    // Mock successful delete
    vi.mocked(actions.deleteSegmentAction).mockResolvedValue({});

    // Render component
    render(<SegmentSettings {...mockProps} />);

    // Find and click the delete button to open the confirmation modal
    const deleteButton = screen.getByText("common.delete");
    fireEvent.click(deleteButton);

    // Verify the delete confirmation modal is displayed
    expect(screen.getByTestId("delete-modal")).toBeInTheDocument();

    // Click the confirm delete button in the modal
    const confirmDeleteButton = screen.getByTestId("confirm-delete");
    fireEvent.click(confirmDeleteButton);

    // Verify deleteSegmentAction was called with correct segment ID
    await waitFor(() => {
      expect(actions.deleteSegmentAction).toHaveBeenCalledWith({
        segmentId: mockProps.initialSegment.id,
      });
    });

    // Verify success toast was displayed with the correct message
    expect(toast.success).toHaveBeenCalledWith("environments.segments.segment_deleted_successfully");

    // Verify state was reset and router was refreshed
    expect(mockProps.setOpen).toHaveBeenCalledWith(false);
  });

  test("should disable the save button if the segment title is empty or filters are invalid", async () => {
    render(<SegmentSettings {...mockProps} />);

    // Initially the save button should be enabled because we have a valid title and filters
    const saveButton = screen.getByTestId("save-button");
    expect(saveButton).not.toBeDisabled();

    // Change the title to empty string
    const titleInput = screen.getAllByTestId("input")[0];
    fireEvent.change(titleInput, { target: { value: "" } });

    // Save button should now be disabled due to empty title
    await waitFor(() => {
      expect(saveButton).toBeDisabled();
    });

    // Reset title to valid value
    fireEvent.change(titleInput, { target: { value: "Valid Title" } });

    // Save button should be enabled again
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    // Now simulate invalid filters
    vi.mocked(ZSegmentFilters.safeParse).mockReturnValue({ success: false } as unknown as SafeParseReturnType<
      TBaseFilters,
      TBaseFilters
    >);

    // We need to trigger a re-render to see the effect of the mocked validation
    // Adding a filter would normally trigger this, but we can simulate by changing any state
    const descriptionInput = screen.getAllByTestId("input")[1];
    fireEvent.change(descriptionInput, { target: { value: "Updated description" } });

    // Save button should be disabled due to invalid filters
    await waitFor(() => {
      expect(saveButton).toBeDisabled();
    });

    // Reset filters to valid
    vi.mocked(ZSegmentFilters.safeParse).mockReturnValue({ success: true } as unknown as SafeParseReturnType<
      TBaseFilters,
      TBaseFilters
    >);

    // Change description again to trigger re-render
    fireEvent.change(descriptionInput, { target: { value: "Another description update" } });

    // Save button should be enabled again
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
  });

  test("should display error message and not proceed with update when recursive segment filter is detected", async () => {
    // Mock updateSegmentAction to return data that would contain an error
    const mockData = { someData: "value" };
    vi.mocked(actions.updateSegmentAction).mockResolvedValue(mockData as unknown as any);

    // Mock getFormattedErrorMessage to return a recursive filter error message
    const recursiveErrorMessage = "Segment cannot reference itself in filters";
    vi.mocked(helper.getFormattedErrorMessage).mockReturnValue(recursiveErrorMessage);

    // Render component
    render(<SegmentSettings {...mockProps} />);

    // Find and click the save button
    const saveButton = screen.getByTestId("save-button");
    fireEvent.click(saveButton);

    // Verify updateSegmentAction was called
    await waitFor(() => {
      expect(actions.updateSegmentAction).toHaveBeenCalledWith({
        environmentId: mockProps.environmentId,
        segmentId: mockProps.initialSegment.id,
        data: {
          title: mockProps.initialSegment.title,
          description: mockProps.initialSegment.description,
          isPrivate: mockProps.initialSegment.isPrivate,
          filters: mockProps.initialSegment.filters,
        },
      });
    });

    // Verify getFormattedErrorMessage was called with the data returned from updateSegmentAction
    expect(helper.getFormattedErrorMessage).toHaveBeenCalledWith(mockData);

    // Verify error toast was displayed with the recursive filter error message
    expect(toast.error).toHaveBeenCalledWith(recursiveErrorMessage);

    // Verify that the update operation was halted (router.refresh and setOpen should not be called)
    expect(mockProps.setOpen).not.toHaveBeenCalled();

    // Verify that success toast was not displayed
    expect(toast.success).not.toHaveBeenCalled();

    // Verify that the button is no longer in loading state
    // This is checking that setIsUpdatingSegment(false) was called
    const updatedSaveButton = screen.getByTestId("save-button");
    expect(updatedSaveButton.getAttribute("data-loading")).not.toBe("true");
  });

  test("should display server error message when updateSegmentAction returns a non-recursive filter error", async () => {
    // Mock server error response
    const serverErrorMessage = "Database connection error";
    vi.mocked(actions.updateSegmentAction).mockResolvedValue({ serverError: "Database connection error" });
    vi.mocked(helper.getFormattedErrorMessage).mockReturnValue(serverErrorMessage);

    // Render component
    render(<SegmentSettings {...mockProps} />);

    // Find and click the save button
    const saveButton = screen.getByTestId("save-button");
    fireEvent.click(saveButton);

    // Verify updateSegmentAction was called
    await waitFor(() => {
      expect(actions.updateSegmentAction).toHaveBeenCalled();
    });

    // Verify getFormattedErrorMessage was called with the response from updateSegmentAction
    expect(helper.getFormattedErrorMessage).toHaveBeenCalledWith({
      serverError: "Database connection error",
    });

    // Verify error toast was displayed with the server error message
    expect(toast.error).toHaveBeenCalledWith(serverErrorMessage);

    // Verify that setOpen was not called (update process should stop)
    expect(mockProps.setOpen).not.toHaveBeenCalled();

    // Verify that the loading state was reset
    const updatedSaveButton = screen.getByTestId("save-button");
    expect(updatedSaveButton.getAttribute("data-loading")).not.toBe("true");
  });

  // [Tusk] FAILING TEST
  test("should add a filter to the segment when a valid filter is selected in the filter modal", async () => {
    // Render component
    render(<SegmentSettings {...mockProps} />);

    // Verify initial filter count is 0
    expect(screen.getByTestId("filter-count").textContent).toBe("0");

    // Find and click the add filter button
    const addFilterButton = screen.getByTestId("add-filter-button");
    fireEvent.click(addFilterButton);

    // Verify filter modal is open
    expect(screen.getByTestId("add-filter-modal")).toBeInTheDocument();

    // Select a filter from the modal
    const addTestFilterButton = screen.getByTestId("add-test-filter");
    fireEvent.click(addTestFilterButton);

    // Verify filter modal is closed and filter is added
    expect(screen.queryByTestId("add-filter-modal")).not.toBeInTheDocument();

    // Verify filter count is now 1
    expect(screen.getByTestId("filter-count").textContent).toBe("1");

    // Verify the save button is enabled
    const saveButton = screen.getByTestId("save-button");
    expect(saveButton).not.toBeDisabled();

    // Click save and verify the segment with the new filter is saved
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(actions.updateSegmentAction).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            filters: expect.arrayContaining([
              expect.objectContaining({
                type: "attribute",
                attributeKey: "testKey",
                connector: null,
              }),
            ]),
          }),
        })
      );
    });
  });
});
