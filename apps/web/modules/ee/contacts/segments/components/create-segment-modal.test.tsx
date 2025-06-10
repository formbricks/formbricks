import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createSegmentAction } from "@/modules/ee/contacts/segments/actions";
import { CreateSegmentModal } from "@/modules/ee/contacts/segments/components/create-segment-modal";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
// Import within
import userEvent from "@testing-library/user-event";
// Removed beforeEach
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment } from "@formbricks/types/segment";

// Mock dependencies
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn((_) => "Formatted error"),
}));

vi.mock("@/modules/ee/contacts/segments/actions", () => ({
  createSegmentAction: vi.fn(),
}));

// Mock child components that are complex or have their own tests
vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="dialog">
        {children}
        <button data-testid="dialog-close" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
  DialogContent: ({
    children,
    className,
    disableCloseOnOutsideClick,
  }: {
    children: React.ReactNode;
    className?: string;
    disableCloseOnOutsideClick?: boolean;
  }) => (
    <div
      data-testid="dialog-content"
      className={className}
      data-disable-close-on-outside-click={disableCloseOnOutsideClick}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogBody: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-body">{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

vi.mock("./add-filter-modal", () => ({
  AddFilterModal: ({ open, setOpen, onAddFilter }) =>
    open ? (
      <div data-testid="add-filter-modal">
        <button
          onClick={() => {
            onAddFilter({
              resource: { type: "attribute", contactAttributeKey: "userId" },
              condition: "equals",
              value: "test",
            });
            setOpen(false);
          }}>
          Add Mock Filter
        </button>
        <button onClick={() => setOpen(false)}>Close Add Filter Modal</button>
      </div>
    ) : null,
}));

vi.mock("./segment-editor", () => ({
  SegmentEditor: ({ group }) => <div data-testid="segment-editor">Filters: {group.length}</div>,
}));

const environmentId = "test-env-id";
const contactAttributeKeys = [
  { name: "userId", label: "User ID", type: "identifier" } as unknown as TContactAttributeKey,
];
const segments = [] as unknown as TSegment[];
const defaultProps = {
  environmentId,
  contactAttributeKeys,
  segments,
};

describe("CreateSegmentModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders create button and opens modal on click", async () => {
    render(<CreateSegmentModal {...defaultProps} />);
    const createButton = screen.getByText("common.create_segment");
    expect(createButton).toBeInTheDocument();
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();

    await userEvent.click(createButton);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByText("common.create_segment", { selector: "h2" })).toBeInTheDocument(); // Modal title
  });

  test("closes modal on cancel button click", async () => {
    render(<CreateSegmentModal {...defaultProps} />);
    const createButton = screen.getByText("common.create_segment");
    await userEvent.click(createButton);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    const cancelButton = screen.getByText("common.cancel");
    await userEvent.click(cancelButton);

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  test("updates title and description state on input change", async () => {
    render(<CreateSegmentModal {...defaultProps} />);
    const createButton = screen.getByText("common.create_segment");
    await userEvent.click(createButton);

    const titleInput = screen.getByPlaceholderText("environments.segments.ex_power_users");
    const descriptionInput = screen.getByPlaceholderText(
      "environments.segments.ex_fully_activated_recurring_users"
    );

    await userEvent.type(titleInput, "My New Segment");
    await userEvent.type(descriptionInput, "Segment description");

    expect(titleInput).toHaveValue("My New Segment");
    expect(descriptionInput).toHaveValue("Segment description");
  });

  test("save button is disabled initially and when title is empty", async () => {
    render(<CreateSegmentModal {...defaultProps} />);
    const createButton = screen.getByText("common.create_segment");
    await userEvent.click(createButton);

    const saveButton = screen.getByText("common.create_segment", { selector: "button[type='submit']" });
    expect(saveButton).toBeDisabled();

    const titleInput = screen.getByPlaceholderText("environments.segments.ex_power_users");
    await userEvent.type(titleInput, " "); // Empty title
    expect(saveButton).toBeDisabled();

    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Valid Title");
    expect(saveButton).not.toBeDisabled();
  });

  test("shows error toast if title is missing on save", async () => {
    render(<CreateSegmentModal {...defaultProps} />);
    const openModalButton = screen.getByRole("button", { name: "common.create_segment" });
    await userEvent.click(openModalButton);

    // Get modal and scope queries
    const modal = await screen.findByTestId("dialog");

    // Find the save button using getByText with a specific selector within the modal
    const saveButton = within(modal).getByText("common.create_segment", {
      selector: "button[type='submit']",
    });

    // Verify the button is disabled because the title is empty
    expect(saveButton).toBeDisabled();

    // Attempt to click the disabled button (optional, confirms no unexpected action occurs)
    await userEvent.click(saveButton);

    // Ensure the action was not called, as the button click should be prevented or the handler check fails early
    expect(createSegmentAction).not.toHaveBeenCalled();
  });

  test("calls createSegmentAction on save with valid data", async () => {
    vi.mocked(createSegmentAction).mockResolvedValue({ data: { id: "new-segment-id" } as any });
    render(<CreateSegmentModal {...defaultProps} />);
    const createButton = screen.getByText("common.create_segment");
    await userEvent.click(createButton);

    // Get modal and scope queries
    const modal = await screen.findByTestId("dialog");

    const titleInput = within(modal).getByPlaceholderText("environments.segments.ex_power_users");
    const descriptionInput = within(modal).getByPlaceholderText(
      "environments.segments.ex_fully_activated_recurring_users"
    );
    await userEvent.type(titleInput, "Power Users");
    await userEvent.type(descriptionInput, "Active users");

    // Find the save button within the modal
    const saveButton = await within(modal).findByRole("button", {
      name: "common.create_segment",
    });
    // Button should be enabled: title is valid, filters=[] is valid.
    expect(saveButton).not.toBeDisabled();
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(createSegmentAction).toHaveBeenCalledWith({
        title: "Power Users",
        description: "Active users",
        isPrivate: false,
        filters: [], // Expect empty array as no filters were added
        environmentId,
        surveyId: "",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("environments.segments.segment_saved_successfully");
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument(); // Modal should close on success
  });

  test("shows error toast if createSegmentAction fails", async () => {
    const errorResponse = { error: { message: "API Error" } } as any; // Mock error response
    vi.mocked(createSegmentAction).mockResolvedValue(errorResponse);
    vi.mocked(getFormattedErrorMessage).mockReturnValue("Formatted API Error");

    render(<CreateSegmentModal {...defaultProps} />);
    const createButton = screen.getByText("common.create_segment");
    await userEvent.click(createButton);

    const titleInput = screen.getByPlaceholderText("environments.segments.ex_power_users");
    await userEvent.type(titleInput, "Fail Segment");

    const saveButton = screen.getByText("common.create_segment", { selector: "button[type='submit']" });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(createSegmentAction).toHaveBeenCalled();
    });
    expect(getFormattedErrorMessage).toHaveBeenCalledWith(errorResponse);
    expect(toast.error).toHaveBeenCalledWith("Formatted API Error");
    expect(screen.getByTestId("dialog")).toBeInTheDocument(); // Modal should stay open on error
  });

  test("shows generic error toast if Zod parsing succeeds during save error handling", async () => {
    vi.mocked(createSegmentAction).mockRejectedValue(new Error("Network error")); // Simulate action throwing

    render(<CreateSegmentModal {...defaultProps} />);
    const openModalButton = screen.getByRole("button", { name: "common.create_segment" }); // Get the button outside the modal first
    await userEvent.click(openModalButton);

    // Get the modal element
    const modal = await screen.findByTestId("dialog");

    const titleInput = within(modal).getByPlaceholderText("environments.segments.ex_power_users");
    await userEvent.type(titleInput, "Generic Error Segment");

    // DO NOT add any filters - segment.filters will remain []

    // Use findByRole scoped within the modal to wait for the submit button to be enabled
    const saveButton = await within(modal).findByRole("button", {
      name: "common.create_segment", // Match the accessible name (text content)
      // Implicitly waits for the button to not have the 'disabled' attribute
    });

    // Now click the enabled button
    await userEvent.click(saveButton);

    // Wait for the expected toast message, implying the action failed and catch block ran
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("common.something_went_wrong_please_try_again");
    });

    // Now that we know the catch block ran, verify the action was called
    expect(createSegmentAction).toHaveBeenCalled();
    expect(screen.getByTestId("dialog")).toBeInTheDocument(); // Modal should stay open
  });

  test("opens AddFilterModal when 'Add Filter' button is clicked", async () => {
    render(<CreateSegmentModal {...defaultProps} />);
    const createButton = screen.getByText("common.create_segment");
    await userEvent.click(createButton);

    expect(screen.queryByTestId("add-filter-modal")).not.toBeInTheDocument();
    const addFilterButton = screen.getByText("common.add_filter");
    await userEvent.click(addFilterButton);

    expect(screen.getByTestId("add-filter-modal")).toBeInTheDocument();
  });

  test("adds filter when onAddFilter is called from AddFilterModal", async () => {
    render(<CreateSegmentModal {...defaultProps} />);
    const createButton = screen.getByText("common.create_segment");
    await userEvent.click(createButton);

    const segmentEditor = screen.getByTestId("segment-editor");
    expect(segmentEditor).toHaveTextContent("Filters: 0");

    const addFilterButton = screen.getByText("common.add_filter");
    await userEvent.click(addFilterButton);

    const addMockFilterButton = screen.getByText("Add Mock Filter");
    await userEvent.click(addMockFilterButton); // This calls onAddFilter in the mock

    expect(screen.queryByTestId("add-filter-modal")).not.toBeInTheDocument(); // Modal should close
    expect(segmentEditor).toHaveTextContent("Filters: 1"); // Check if filter count increased
  });

  test("adds second filter correctly with default connector", async () => {
    render(<CreateSegmentModal {...defaultProps} />);
    const createButton = screen.getByText("common.create_segment");
    await userEvent.click(createButton);

    const segmentEditor = screen.getByTestId("segment-editor");
    const addFilterButton = screen.getByText("common.add_filter");

    // Add first filter
    await userEvent.click(addFilterButton);
    await userEvent.click(screen.getByText("Add Mock Filter"));
    expect(segmentEditor).toHaveTextContent("Filters: 1");

    // Add second filter
    await userEvent.click(addFilterButton);
    await userEvent.click(screen.getByText("Add Mock Filter"));
    expect(segmentEditor).toHaveTextContent("Filters: 2");
  });
});
