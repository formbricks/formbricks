import { AddFilterModal } from "@/modules/ee/contacts/segments/components/add-filter-modal";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment } from "@formbricks/types/segment";

// Mock the Modal component
vi.mock("@/modules/ui/components/modal", () => ({
  Modal: ({ children, open }: { children: React.ReactNode; open: boolean }) => {
    return open ? <div>{children}</div> : null; // NOSONAR // This is a mock
  },
}));

// Mock the TabBar component
vi.mock("@/modules/ui/components/tab-bar", () => ({
  TabBar: ({
    tabs,
    activeId,
    setActiveId,
  }: {
    tabs: any[];
    activeId: string;
    setActiveId: (id: string) => void;
  }) => (
    <div>
      {tabs.map((tab) => (
        <button key={tab.id} data-testid={`tab-${tab.id}`} onClick={() => setActiveId(tab.id)}>
          {tab.label} {activeId === tab.id ? "(Active)" : ""}
        </button>
      ))}
    </div>
  ),
}));

const mockContactAttributeKeys: TContactAttributeKey[] = [
  {
    id: "attr1",
    key: "email",
    name: "Email Address",
    environmentId: "env1",
  } as unknown as TContactAttributeKey,
  { id: "attr2", key: "plan", name: "Plan Type", environmentId: "env1" } as unknown as TContactAttributeKey,
];

const mockSegments: TSegment[] = [
  {
    id: "seg1",
    title: "Active Users",
    description: "Users active in the last 7 days",
    isPrivate: false,
    filters: [],
    environmentId: "env1",
    surveys: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "seg2",
    title: "Paying Customers",
    description: "Users with plan type 'paid'",
    isPrivate: false,
    filters: [],
    environmentId: "env1",
    surveys: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "seg3",
    title: "Private Segment",
    description: "This is private",
    isPrivate: true,
    filters: [],
    environmentId: "env1",
    surveys: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("AddFilterModal", () => {
  let onAddFilter: ReturnType<typeof vi.fn>;
  let setOpen: ReturnType<typeof vi.fn>;
  const user = userEvent.setup();

  beforeEach(() => {
    onAddFilter = vi.fn();
    setOpen = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders correctly when open", () => {
    render(
      <AddFilterModal
        open={true}
        setOpen={setOpen}
        onAddFilter={onAddFilter}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
      />
    );

    expect(screen.getByPlaceholderText("Browse filters...")).toBeInTheDocument();
    expect(screen.getByTestId("tab-all")).toHaveTextContent("common.all (Active)");
    expect(screen.getByText("Email Address")).toBeInTheDocument();
    expect(screen.getByText("Plan Type")).toBeInTheDocument();
    expect(screen.getByText("userId")).toBeInTheDocument();
    expect(screen.getByText("Active Users")).toBeInTheDocument();
    expect(screen.getByText("Paying Customers")).toBeInTheDocument();
    expect(screen.queryByText("Private Segment")).not.toBeInTheDocument(); // Private segments shouldn't show
    expect(screen.getByText("environments.segments.phone")).toBeInTheDocument();
    expect(screen.getByText("environments.segments.desktop")).toBeInTheDocument();
  });

  test("does not render when closed", () => {
    render(
      <AddFilterModal
        open={false}
        setOpen={setOpen}
        onAddFilter={onAddFilter}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
      />
    );
    expect(screen.queryByPlaceholderText("Browse filters...")).not.toBeInTheDocument();
  });

  test("filters items based on search input in 'All' tab", async () => {
    render(
      <AddFilterModal
        open={true}
        setOpen={setOpen}
        onAddFilter={onAddFilter}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
      />
    );

    const searchInput = screen.getByPlaceholderText("Browse filters...");
    await user.type(searchInput, "Email");

    expect(screen.getByText("Email Address")).toBeInTheDocument();
    expect(screen.queryByText("Plan Type")).not.toBeInTheDocument();
    expect(screen.queryByText("User ID")).not.toBeInTheDocument();
    expect(screen.queryByText("Active Users")).not.toBeInTheDocument();
    expect(screen.queryByText("Paying Customers")).not.toBeInTheDocument();
    expect(screen.queryByText("Phone")).not.toBeInTheDocument();
    expect(screen.queryByText("Desktop")).not.toBeInTheDocument();
  });

  test("switches tabs and displays correct content", async () => {
    render(
      <AddFilterModal
        open={true}
        setOpen={setOpen}
        onAddFilter={onAddFilter}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
      />
    );

    // Switch to Attributes tab
    const attributesTabButton = screen.getByTestId("tab-attributes");
    await user.click(attributesTabButton);
    expect(attributesTabButton).toHaveTextContent("environments.segments.person_and_attributes (Active)");
    expect(screen.getByText("common.user_id")).toBeInTheDocument();
    expect(screen.getByText("Email Address")).toBeInTheDocument();
    expect(screen.getByText("Plan Type")).toBeInTheDocument();
    expect(screen.queryByText("Active Users")).not.toBeInTheDocument();
    expect(screen.queryByText("environments.segments.phone")).not.toBeInTheDocument();

    // Switch to Segments tab
    const segmentsTabButton = screen.getByTestId("tab-segments");
    await user.click(segmentsTabButton);
    expect(segmentsTabButton).toHaveTextContent("common.segments (Active)");
    expect(screen.getByText("Active Users")).toBeInTheDocument();
    expect(screen.getByText("Paying Customers")).toBeInTheDocument();
    expect(screen.queryByText("Private Segment")).not.toBeInTheDocument();
    expect(screen.queryByText("Email Address")).not.toBeInTheDocument();
    expect(screen.queryByText("common.user_id")).not.toBeInTheDocument();
    expect(screen.queryByText("environments.segments.phone")).not.toBeInTheDocument();

    // Switch to Devices tab
    const devicesTabButton = screen.getByTestId("tab-devices");
    await user.click(devicesTabButton);
    expect(devicesTabButton).toHaveTextContent("environments.segments.devices (Active)");
    expect(screen.getByText("environments.segments.phone")).toBeInTheDocument();
    expect(screen.getByText("environments.segments.desktop")).toBeInTheDocument();
    expect(screen.queryByText("Active Users")).not.toBeInTheDocument();
    expect(screen.queryByText("Email Address")).not.toBeInTheDocument();
  });

  test("calls onAddFilter with correct payload for attribute filter", async () => {
    render(
      <AddFilterModal
        open={true}
        setOpen={setOpen}
        onAddFilter={onAddFilter}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
      />
    );

    const attributeItem = screen.getByText("Email Address");
    await user.click(attributeItem);

    expect(onAddFilter).toHaveBeenCalledTimes(1);
    expect(onAddFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        connector: "and",
        resource: expect.objectContaining({
          root: { type: "attribute", contactAttributeKey: "email" },
          qualifier: { operator: "equals" },
          value: "",
        }),
      })
    );
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  test("calls onAddFilter with correct payload for person filter", async () => {
    render(
      <AddFilterModal
        open={true}
        setOpen={setOpen}
        onAddFilter={onAddFilter}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
      />
    );

    const personItem = screen.getByText("userId");
    await user.click(personItem);

    expect(onAddFilter).toHaveBeenCalledTimes(1);
    expect(onAddFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        connector: "and",
        resource: expect.objectContaining({
          root: { type: "person", personIdentifier: "userId" },
          qualifier: { operator: "equals" },
          value: "",
        }),
      })
    );
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  test("calls onAddFilter with correct payload for segment filter", async () => {
    render(
      <AddFilterModal
        open={true}
        setOpen={setOpen}
        onAddFilter={onAddFilter}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
      />
    );

    const segmentItem = screen.getByText("Active Users");
    await user.click(segmentItem);

    expect(onAddFilter).toHaveBeenCalledTimes(1);
    expect(onAddFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        connector: "and",
        resource: expect.objectContaining({
          root: { type: "segment", segmentId: "seg1" },
          qualifier: { operator: "userIsIn" },
          value: "seg1",
        }),
      })
    );
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  test("calls onAddFilter with correct payload for device filter", async () => {
    render(
      <AddFilterModal
        open={true}
        setOpen={setOpen}
        onAddFilter={onAddFilter}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
      />
    );

    const deviceItem = screen.getByText("environments.segments.phone");
    await user.click(deviceItem);

    expect(onAddFilter).toHaveBeenCalledTimes(1);
    expect(onAddFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        connector: "and",
        resource: expect.objectContaining({
          root: { type: "device", deviceType: "phone" },
          qualifier: { operator: "equals" },
          value: "phone",
        }),
      })
    );
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  test("handles keyboard interaction (Enter) for adding a filter", async () => {
    render(
      <AddFilterModal
        open={true}
        setOpen={setOpen}
        onAddFilter={onAddFilter}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
      />
    );

    // Need to switch to attributes tab to test keyboard on person filter
    const attributesTabButton = screen.getByTestId("tab-attributes");
    await user.click(attributesTabButton);

    const personItem = screen.getByTestId("person-filter-item"); // Use data-testid here
    personItem.focus();
    expect(personItem).toHaveFocus(); // Verify focus is set
    await user.keyboard("{Enter}");

    expect(onAddFilter).toHaveBeenCalledTimes(1);
    expect(onAddFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: expect.objectContaining({
          root: { type: "person", personIdentifier: "userId" },
        }),
      })
    );
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  test("handles keyboard interaction (Space) for adding a filter", async () => {
    render(
      <AddFilterModal
        open={true}
        setOpen={setOpen}
        onAddFilter={onAddFilter}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
      />
    );

    // Switch to attributes tab
    const attributesTabButton = screen.getByTestId("tab-attributes");
    await user.click(attributesTabButton);

    const personItem = screen.getByTestId("person-filter-item");
    personItem.focus();
    expect(personItem).toHaveFocus();
    await user.keyboard(" "); // Test Space key

    expect(onAddFilter).toHaveBeenCalledTimes(1);
    expect(onAddFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: expect.objectContaining({
          root: { type: "person", personIdentifier: "userId" },
        }),
      })
    );
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  test("displays 'no attributes yet' message", async () => {
    render(
      <AddFilterModal
        open={true}
        setOpen={setOpen}
        onAddFilter={onAddFilter}
        contactAttributeKeys={[]} // Empty attributes
        segments={mockSegments}
      />
    );

    // Switch to Attributes tab
    const attributesTabButton = screen.getByTestId("tab-attributes");
    await user.click(attributesTabButton);

    expect(screen.getByText("environments.segments.no_attributes_yet")).toBeInTheDocument();
  });

  test("displays 'no segments yet' message", async () => {
    render(
      <AddFilterModal
        open={true}
        setOpen={setOpen}
        onAddFilter={onAddFilter}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={[]} // Empty segments
      />
    );

    // Switch to Segments tab
    const segmentsTabButton = screen.getByTestId("tab-segments");
    await user.click(segmentsTabButton);

    expect(screen.getByText("environments.segments.no_segments_yet")).toBeInTheDocument();
  });

  test("displays 'no filters match' message when search yields no results", async () => {
    render(
      <AddFilterModal
        open={true}
        setOpen={setOpen}
        onAddFilter={onAddFilter}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
      />
    );

    const searchInput = screen.getByPlaceholderText("Browse filters...");
    await user.type(searchInput, "nonexistentfilter");

    expect(screen.getByText("environments.segments.no_filters_yet")).toBeInTheDocument();
    expect(screen.queryByText("Email Address")).not.toBeInTheDocument();
    expect(screen.queryByText("Active Users")).not.toBeInTheDocument();
    expect(screen.queryByText("Phone")).not.toBeInTheDocument();
  });
});
