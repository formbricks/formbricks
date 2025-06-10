import { EditSegmentModal } from "@/modules/ee/contacts/segments/components/edit-segment-modal";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSegmentWithSurveyNames } from "@formbricks/types/segment";

// Mock child components
vi.mock("@/modules/ee/contacts/segments/components/segment-settings", () => ({
  SegmentSettings: vi.fn(() => <div data-testid="segment-settings">SegmentSettingsMock</div>),
}));
vi.mock("@/modules/ee/contacts/segments/components/segment-activity-tab", () => ({
  SegmentActivityTab: vi.fn(() => <div data-testid="segment-activity-tab">SegmentActivityTabMock</div>),
}));

// Mock the Dialog components
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
    disableCloseOnOutsideClick,
  }: {
    children: React.ReactNode;
    disableCloseOnOutsideClick?: boolean;
  }) => (
    <div data-testid="dialog-content" data-disable-close-on-outside-click={disableCloseOnOutsideClick}>
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
}));

// Mock useTranslate
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      const translations = {
        "common.activity": "Activity",
        "common.settings": "Settings",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  UsersIcon: ({ className }: { className?: string }) => (
    <span data-testid="users-icon" className={className}>
      👥
    </span>
  ),
}));

const mockSegment = {
  id: "seg1",
  title: "Test Segment",
  description: "This is a test segment",
  environmentId: "env1",
  surveys: ["Survey 1", "Survey 2"],
  filters: [],
  isPrivate: false,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as TSegmentWithSurveyNames;

const defaultProps = {
  environmentId: "env1",
  open: true,
  setOpen: vi.fn(),
  currentSegment: mockSegment,
  segments: [],
  contactAttributeKeys: [],
  isContactsEnabled: true,
  isReadOnly: false,
};

describe("EditSegmentModal", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders correctly when open and contacts enabled", () => {
    render(<EditSegmentModal {...defaultProps} />);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Test Segment");
    expect(screen.getByTestId("dialog-description")).toHaveTextContent("This is a test segment");
    expect(screen.getByTestId("users-icon")).toBeInTheDocument();
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    // Only the first tab (Activity) should be active initially
    expect(screen.getByTestId("segment-activity-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("segment-settings")).not.toBeInTheDocument();
  });

  test("renders correctly when open and contacts disabled", () => {
    render(<EditSegmentModal {...defaultProps} isContactsEnabled={false} />);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Test Segment");
    expect(screen.getByTestId("dialog-description")).toHaveTextContent("This is a test segment");
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByTestId("segment-activity-tab")).toBeInTheDocument();
    // Settings tab content should not render when contacts are disabled
    expect(screen.queryByTestId("segment-settings")).not.toBeInTheDocument();
  });

  test("does not render when open is false", () => {
    render(<EditSegmentModal {...defaultProps} open={false} />);

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Test Segment")).not.toBeInTheDocument();
    expect(screen.queryByText("Activity")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  test("switches tabs correctly", async () => {
    const user = userEvent.setup();
    render(<EditSegmentModal {...defaultProps} />);

    // Initially shows activity tab (first tab is active)
    expect(screen.getByTestId("segment-activity-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("segment-settings")).not.toBeInTheDocument();

    // Click settings tab
    const settingsTab = screen.getByText("Settings");
    await user.click(settingsTab);

    // Now shows settings tab content
    expect(screen.queryByTestId("segment-activity-tab")).not.toBeInTheDocument();
    expect(screen.getByTestId("segment-settings")).toBeInTheDocument();

    // Click activity tab again
    const activityTab = screen.getByText("Activity");
    await user.click(activityTab);

    // Back to activity tab content
    expect(screen.getByTestId("segment-activity-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("segment-settings")).not.toBeInTheDocument();
  });

  test("resets to first tab when modal is reopened", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<EditSegmentModal {...defaultProps} />);

    // Switch to settings tab
    const settingsTab = screen.getByText("Settings");
    await user.click(settingsTab);
    expect(screen.getByTestId("segment-settings")).toBeInTheDocument();

    // Close modal
    rerender(<EditSegmentModal {...defaultProps} open={false} />);

    // Reopen modal
    rerender(<EditSegmentModal {...defaultProps} open={true} />);

    // Should be back to activity tab (first tab)
    expect(screen.getByTestId("segment-activity-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("segment-settings")).not.toBeInTheDocument();
  });

  test("handles segment without description", () => {
    const segmentWithoutDescription = { ...mockSegment, description: "" };
    render(<EditSegmentModal {...defaultProps} currentSegment={segmentWithoutDescription} />);

    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Test Segment");
    expect(screen.getByTestId("dialog-description")).toHaveTextContent("");
  });
});
