import * as segmentUtils from "@/modules/ee/contacts/segments/lib/utils";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TBaseFilter, TBaseFilters, TSegment } from "@formbricks/types/segment";
import { SegmentEditor } from "./segment-editor";

// Mock child components
vi.mock("./segment-filter", () => ({
  SegmentFilter: vi.fn(({ resource }) => <div>SegmentFilter Mock: {resource.attributeKey}</div>),
}));
vi.mock("./add-filter-modal", () => ({
  AddFilterModal: vi.fn(({ open, setOpen }) => (
    <div>
      AddFilterModal Mock {open ? "Open" : "Closed"}
      <button onClick={() => setOpen(false)}>Close Modal</button>
    </div>
  )),
}));

// Mock utility functions
vi.mock("@/modules/ee/contacts/segments/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof segmentUtils>();
  return {
    ...actual,
    addFilterBelow: vi.fn(),
    addFilterInGroup: vi.fn(),
    createGroupFromResource: vi.fn(),
    deleteResource: vi.fn(),
    moveResource: vi.fn(),
    toggleGroupConnector: vi.fn(),
  };
});

const mockSetSegment = vi.fn();
const mockEnvironmentId = "test-env-id";
const mockContactAttributeKeys: TContactAttributeKey[] = [
  { name: "email", type: "default" } as unknown as TContactAttributeKey,
  { name: "userId", type: "default" } as unknown as TContactAttributeKey,
];
const mockSegments: TSegment[] = [];

const mockSegmentBase: TSegment = {
  id: "seg1",
  environmentId: mockEnvironmentId,
  title: "Test Segment",
  description: "A segment for testing",
  isPrivate: false,
  filters: [], // Will be populated in tests
  surveys: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const filterResource1 = {
  id: "filter1",
  attributeKey: "email",
  attributeValue: "test@example.com",
  condition: "equals",
  root: {
    connector: null,
    filterId: "filter1",
  },
};

const filterResource2 = {
  id: "filter2",
  attributeKey: "userId",
  attributeValue: "user123",
  condition: "equals",
  root: {
    connector: "and",
    filterId: "filter2",
  },
};

const groupResource1 = {
  id: "group1",
  connector: "and",
  resource: [
    {
      connector: null,
      resource: filterResource1,
      id: "filter1",
    },
  ],
} as unknown as TBaseFilter;

const groupResource2 = {
  id: "group2",
  connector: "or",
  resource: [
    {
      connector: null,
      resource: filterResource2,
      id: "filter2",
    },
  ],
} as unknown as TBaseFilter;

const mockGroupWithFilters = [
  {
    connector: null,
    resource: filterResource1,
    id: "filter1",
  } as unknown as TBaseFilter,
  {
    connector: "and",
    resource: filterResource2,
    id: "filter2",
  } as unknown as TBaseFilter,
] as unknown as TBaseFilters;

const mockGroupWithNestedGroup = [
  {
    connector: null,
    resource: filterResource1,
    id: "filter1",
  },
  groupResource1,
] as unknown as TBaseFilters;

describe("SegmentEditor", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders SegmentFilter for filter resources", () => {
    const segment = { ...mockSegmentBase, filters: mockGroupWithFilters };
    render(
      <SegmentEditor
        group={mockGroupWithFilters}
        environmentId={mockEnvironmentId}
        segment={segment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        setSegment={mockSetSegment}
      />
    );
    expect(screen.getByText("SegmentFilter Mock: email")).toBeInTheDocument();
    expect(screen.getByText("SegmentFilter Mock: userId")).toBeInTheDocument();
  });

  test("renders nested SegmentEditor for group resources", () => {
    const segment = { ...mockSegmentBase, filters: mockGroupWithNestedGroup };
    render(
      <SegmentEditor
        group={mockGroupWithNestedGroup}
        environmentId={mockEnvironmentId}
        segment={segment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        setSegment={mockSetSegment}
      />
    );
    // Check that both instances of the email filter are rendered
    expect(screen.getAllByText("SegmentFilter Mock: email")).toHaveLength(2);
    // Nested group rendering
    expect(screen.getByText("and")).toBeInTheDocument(); // Group connector
    expect(screen.getByText("common.add_filter")).toBeInTheDocument(); // Add filter button inside group
  });

  test("handles connector click", async () => {
    const user = userEvent.setup();
    const segment = { ...mockSegmentBase, filters: [groupResource1] };
    render(
      <SegmentEditor
        group={[groupResource1]}
        environmentId={mockEnvironmentId}
        segment={segment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        setSegment={mockSetSegment}
      />
    );

    const connectorElement = screen.getByText("and");
    await user.click(connectorElement);

    expect(segmentUtils.toggleGroupConnector).toHaveBeenCalledWith(
      expect.any(Array),
      groupResource1.id,
      "or"
    );
    expect(mockSetSegment).toHaveBeenCalled();
  });

  test("handles 'Add Filter' button click inside a group", async () => {
    const user = userEvent.setup();
    const segment = { ...mockSegmentBase, filters: [groupResource1] };
    render(
      <SegmentEditor
        group={[groupResource1]}
        environmentId={mockEnvironmentId}
        segment={segment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        setSegment={mockSetSegment}
      />
    );

    const addButton = screen.getByText("common.add_filter");
    await user.click(addButton);

    expect(screen.getByText("AddFilterModal Mock Open")).toBeInTheDocument();
    // Further tests could simulate adding a filter via the modal mock if needed
  });

  test("handles 'Add Filter Below' dropdown action", async () => {
    const user = userEvent.setup();
    const segment = { ...mockSegmentBase, filters: [groupResource1] };
    render(
      <SegmentEditor
        group={[groupResource1]}
        environmentId={mockEnvironmentId}
        segment={segment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        setSegment={mockSetSegment}
      />
    );

    const menuTrigger = screen.getByTestId("segment-editor-group-menu-trigger");
    await user.click(menuTrigger);
    const addBelowItem = await screen.findByText("environments.segments.add_filter_below"); // Changed to findByText
    await user.click(addBelowItem);

    expect(screen.getByText("AddFilterModal Mock Open")).toBeInTheDocument();
    // Further tests could simulate adding a filter via the modal mock and check addFilterBelow call
  });

  test("handles 'Create Group' dropdown action", async () => {
    const user = userEvent.setup();
    const segment = { ...mockSegmentBase, filters: [groupResource1] };
    render(
      <SegmentEditor
        group={[groupResource1]}
        environmentId={mockEnvironmentId}
        segment={segment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        setSegment={mockSetSegment}
      />
    );

    const menuTrigger = screen.getByTestId("segment-editor-group-menu-trigger"); // Use data-testid
    await user.click(menuTrigger);
    const createGroupItem = await screen.findByText("environments.segments.create_group"); // Use findByText for async rendering
    await user.click(createGroupItem);

    expect(segmentUtils.createGroupFromResource).toHaveBeenCalledWith(expect.any(Array), groupResource1.id);
    expect(mockSetSegment).toHaveBeenCalled();
  });

  test("handles 'Move Up' dropdown action", async () => {
    const user = userEvent.setup();
    const segment = { ...mockSegmentBase, filters: [groupResource1, groupResource2] }; // Need at least two items
    render(
      <SegmentEditor
        group={[groupResource1, groupResource2]}
        environmentId={mockEnvironmentId}
        segment={segment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        setSegment={mockSetSegment}
      />
    );

    // Target the second group's menu
    const menuTriggers = screen.getAllByTestId("segment-editor-group-menu-trigger");
    await user.click(menuTriggers[1]); // Click the second MoreVertical icon trigger
    const moveUpItem = await screen.findByText("common.move_up"); // Changed to findByText
    await user.click(moveUpItem);

    expect(segmentUtils.moveResource).toHaveBeenCalledWith(expect.any(Array), groupResource2.id, "up");
    expect(mockSetSegment).toHaveBeenCalled();
  });

  test("handles 'Move Down' dropdown action", async () => {
    const user = userEvent.setup();
    const segment = { ...mockSegmentBase, filters: [groupResource1, groupResource2] }; // Need at least two items
    render(
      <SegmentEditor
        group={[groupResource1, groupResource2]}
        environmentId={mockEnvironmentId}
        segment={segment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        setSegment={mockSetSegment}
      />
    );

    // Target the first group's menu
    const menuTriggers = screen.getAllByTestId("segment-editor-group-menu-trigger");
    await user.click(menuTriggers[0]); // Click the first MoreVertical icon trigger
    const moveDownItem = await screen.findByText("common.move_down"); // Changed to findByText
    await user.click(moveDownItem);

    expect(segmentUtils.moveResource).toHaveBeenCalledWith(expect.any(Array), groupResource1.id, "down");
    expect(mockSetSegment).toHaveBeenCalled();
  });

  test("handles delete group button click", async () => {
    const user = userEvent.setup();
    const segment = { ...mockSegmentBase, filters: [groupResource1] };
    render(
      <SegmentEditor
        group={[groupResource1]}
        environmentId={mockEnvironmentId}
        segment={segment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        setSegment={mockSetSegment}
      />
    );

    const deleteButton = screen.getByTestId("delete-resource");
    await user.click(deleteButton);

    expect(segmentUtils.deleteResource).toHaveBeenCalledWith(expect.any(Array), groupResource1.id);
    expect(mockSetSegment).toHaveBeenCalled();
  });

  test("renders correctly in viewOnly mode", () => {
    const segment = { ...mockSegmentBase, filters: [groupResource1] };
    render(
      <SegmentEditor
        group={[groupResource1]}
        environmentId={mockEnvironmentId}
        segment={segment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        setSegment={mockSetSegment}
        viewOnly={true}
      />
    );

    // Check if interactive elements are disabled or have specific styles
    const connectorElement = screen.getByText("and");
    expect(connectorElement).toHaveClass("cursor-not-allowed");

    const addButton = screen.getByText("common.add_filter");
    expect(addButton).toBeDisabled();

    const menuTrigger = screen.getByTestId("segment-editor-group-menu-trigger"); // Updated selector
    expect(menuTrigger).toBeDisabled();

    const deleteButton = screen.getByTestId("delete-resource");
    expect(deleteButton).toBeDisabled();
    expect(deleteButton.querySelector("svg")).toHaveClass("cursor-not-allowed"); // Check icon style
  });

  test("does not call handlers in viewOnly mode", async () => {
    const user = userEvent.setup();
    const segment = { ...mockSegmentBase, filters: [groupResource1] };
    render(
      <SegmentEditor
        group={[groupResource1]}
        environmentId={mockEnvironmentId}
        segment={segment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        setSegment={mockSetSegment}
        viewOnly={true}
      />
    );

    // Attempt to click connector
    const connectorElement = screen.getByText("and");
    await user.click(connectorElement);
    expect(segmentUtils.toggleGroupConnector).not.toHaveBeenCalled();

    // Attempt to click add filter
    const addButton = screen.getByText("common.add_filter");
    await user.click(addButton);
    // Modal should not open
    expect(screen.queryByText("AddFilterModal Mock Open")).not.toBeInTheDocument();

    // Attempt to click delete
    const deleteButton = screen.getByTestId("delete-resource");
    await user.click(deleteButton);
    expect(segmentUtils.deleteResource).not.toHaveBeenCalled();

    // Dropdown menu trigger is disabled, so no need to test clicking items inside
  });

  test("connector button is focusable and activates on Enter/Space", async () => {
    const user = userEvent.setup();
    const segment = { ...mockSegmentBase, filters: [groupResource1] };
    render(
      <SegmentEditor
        group={[groupResource1]}
        environmentId={mockEnvironmentId}
        segment={segment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        setSegment={mockSetSegment}
      />
    );

    const connectorButton = screen.getByText("and");
    // Focus the button directly instead of tabbing to it
    connectorButton.focus();

    // Simulate pressing Enter
    await user.keyboard("[Enter]");
    expect(segmentUtils.toggleGroupConnector).toHaveBeenCalledWith(
      expect.any(Array),
      groupResource1.id,
      "or"
    );

    vi.mocked(segmentUtils.toggleGroupConnector).mockClear(); // Clear mock for next assertion

    // Simulate pressing Space
    await user.keyboard(" ");
    expect(segmentUtils.toggleGroupConnector).toHaveBeenCalledWith(
      expect.any(Array),
      groupResource1.id,
      "or"
    );
  });

  test("connector button has accessibility attributes", () => {
    const segment = { ...mockSegmentBase, filters: [groupResource1] };
    render(
      <SegmentEditor
        group={[groupResource1]}
        environmentId={mockEnvironmentId}
        segment={segment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        setSegment={mockSetSegment}
      />
    );

    const connectorElement = screen.getByText("and");
    expect(connectorElement.tagName.toLowerCase()).toBe("button");
  });

  test("connector button and add filter button are both keyboard focusable and reachable via tabbing", async () => {
    const user = userEvent.setup();
    const segment = { ...mockSegmentBase, filters: [groupResource1] };
    render(
      <SegmentEditor
        group={[groupResource1]}
        environmentId={mockEnvironmentId}
        segment={segment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        setSegment={mockSetSegment}
      />
    );

    const connectorButton = screen.getByText("and");
    const addFilterButton = screen.getByTestId("add-filter-button");

    // Tab through the page and collect focusable elements
    const focusable: (Element | null)[] = [];
    for (let i = 0; i < 10; i++) {
      // Arbitrary upper bound to avoid infinite loop
      await user.tab();
      focusable.push(document.activeElement);
      if (document.activeElement === document.body) break;
    }

    // Filter out nulls for the assertion
    const nonNullFocusable = focusable.filter((el): el is Element => el !== null);
    expect(nonNullFocusable).toContain(connectorButton);
    expect(nonNullFocusable).toContain(addFilterButton);
  });

  test("connector button and add filter button can be focused independently", () => {
    const segment = { ...mockSegmentBase, filters: [groupResource1] };
    render(
      <SegmentEditor
        group={[groupResource1]}
        environmentId={mockEnvironmentId}
        segment={segment}
        segments={mockSegments}
        contactAttributeKeys={mockContactAttributeKeys}
        setSegment={mockSetSegment}
      />
    );

    const connectorButton = screen.getByText("and");
    const addFilterButton = screen.getByTestId("add-filter-button");

    connectorButton.focus();
    expect(document.activeElement).toBe(connectorButton);

    addFilterButton.focus();
    expect(document.activeElement).toBe(addFilterButton);
  });
});
