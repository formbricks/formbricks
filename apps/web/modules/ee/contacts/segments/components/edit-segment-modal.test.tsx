import { EditSegmentModal } from "@/modules/ee/contacts/segments/components/edit-segment-modal";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSegmentWithSurveyNames } from "@formbricks/types/segment";

// Mock child components
vi.mock("@/modules/ee/contacts/segments/components/segment-settings", () => ({
  SegmentSettings: vi.fn(() => <div>SegmentSettingsMock</div>),
}));
vi.mock("@/modules/ee/contacts/segments/components/segment-activity-tab", () => ({
  SegmentActivityTab: vi.fn(() => <div>SegmentActivityTabMock</div>),
}));
vi.mock("@/modules/ui/components/modal-with-tabs", () => ({
  ModalWithTabs: vi.fn(({ open, label, description, tabs, icon }) =>
    open ? (
      <div>
        <h1>{label}</h1>
        <p>{description}</p>
        <div>{icon}</div>
        <ul>
          {tabs.map((tab) => (
            <li key={tab.title}>
              <h2>{tab.title}</h2>
              <div>{tab.children}</div>
            </li>
          ))}
        </ul>
      </div>
    ) : null
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

  test("renders correctly when open and contacts enabled", async () => {
    render(<EditSegmentModal {...defaultProps} />);

    expect(screen.getByText("Test Segment")).toBeInTheDocument();
    expect(screen.getByText("This is a test segment")).toBeInTheDocument();
    expect(screen.getByText("common.activity")).toBeInTheDocument();
    expect(screen.getByText("common.settings")).toBeInTheDocument();
    expect(screen.getByText("SegmentActivityTabMock")).toBeInTheDocument();
    expect(screen.getByText("SegmentSettingsMock")).toBeInTheDocument();

    const ModalWithTabsMock = vi.mocked(
      await import("@/modules/ui/components/modal-with-tabs")
    ).ModalWithTabs;

    // Check that the mock was called
    expect(ModalWithTabsMock).toHaveBeenCalled();

    // Get the arguments of the first call
    const callArgs = ModalWithTabsMock.mock.calls[0];
    expect(callArgs).toBeDefined(); // Ensure the mock was called

    const propsPassed = callArgs[0]; // The first argument is the props object

    // Assert individual properties
    expect(propsPassed.open).toBe(true);
    expect(propsPassed.setOpen).toBe(defaultProps.setOpen);
    expect(propsPassed.label).toBe("Test Segment");
    expect(propsPassed.description).toBe("This is a test segment");
    expect(propsPassed.closeOnOutsideClick).toBe(false);
    expect(propsPassed.icon).toBeDefined(); // Check if icon exists
    expect(propsPassed.tabs).toHaveLength(2); // Check number of tabs

    // Check properties of the first tab
    expect(propsPassed.tabs[0].title).toBe("common.activity");
    expect(propsPassed.tabs[0].children).toBeDefined();

    // Check properties of the second tab
    expect(propsPassed.tabs[1].title).toBe("common.settings");
    expect(propsPassed.tabs[1].children).toBeDefined();
  });

  test("renders correctly when open and contacts disabled", async () => {
    render(<EditSegmentModal {...defaultProps} isContactsEnabled={false} />);

    expect(screen.getByText("Test Segment")).toBeInTheDocument();
    expect(screen.getByText("This is a test segment")).toBeInTheDocument();
    expect(screen.getByText("common.activity")).toBeInTheDocument();
    expect(screen.getByText("common.settings")).toBeInTheDocument(); // Tab title still exists
    expect(screen.getByText("SegmentActivityTabMock")).toBeInTheDocument();
    // Check that the settings content is not rendered, which is the key behavior
    expect(screen.queryByText("SegmentSettingsMock")).not.toBeInTheDocument();

    const ModalWithTabsMock = vi.mocked(
      await import("@/modules/ui/components/modal-with-tabs")
    ).ModalWithTabs;
    const calls = ModalWithTabsMock.mock.calls;
    const lastCallArgs = calls[calls.length - 1][0]; // Get the props of the last call

    // Check that the Settings tab was passed in props
    const settingsTab = lastCallArgs.tabs.find((tab) => tab.title === "common.settings");
    expect(settingsTab).toBeDefined();
    // The children prop will be <SettingsTab />, but its rendered output is null/empty.
    // The check above (queryByText("SegmentSettingsMock")) already confirms this.
    // No need to check settingsTab.children === null here.
  });

  test("does not render when open is false", () => {
    render(<EditSegmentModal {...defaultProps} open={false} />);

    expect(screen.queryByText("Test Segment")).not.toBeInTheDocument();
    expect(screen.queryByText("common.activity")).not.toBeInTheDocument();
    expect(screen.queryByText("common.settings")).not.toBeInTheDocument();
  });
});
