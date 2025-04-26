import { AddFilterModal } from "@/modules/ee/contacts/segments/components/add-filter-modal";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
// Added waitFor
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

// Mock createId
vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(() => "mockCuid"),
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

// Helper function to check filter payload
const expectFilterPayload = (
  callArgs: any[],
  expectedType: string,
  expectedRoot: object,
  expectedQualifierOp: string,
  expectedValue: string | undefined
) => {
  expect(callArgs[0]).toEqual(
    expect.objectContaining({
      id: "mockCuid",
      connector: "and",
      resource: expect.objectContaining({
        id: "mockCuid",
        root: expect.objectContaining({ type: expectedType, ...expectedRoot }),
        qualifier: expect.objectContaining({ operator: expectedQualifierOp }),
        value: expectedValue,
      }),
    })
  );
};

describe("AddFilterModal", () => {
  let onAddFilter: ReturnType<typeof vi.fn>;
  let setOpen: ReturnType<typeof vi.fn>;
  const user = userEvent.setup();

  beforeEach(() => {
    onAddFilter = vi.fn();
    setOpen = vi.fn();
    vi.clearAllMocks(); // Clear mocks before each test
  });

  afterEach(() => {
    cleanup();
  });

  // --- Existing Tests (Rendering, Search, Tab Switching) ---
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
    // ... assertions ...
    expect(screen.getByPlaceholderText("Browse filters...")).toBeInTheDocument();
    expect(screen.getByTestId("tab-all")).toHaveTextContent("common.all (Active)");
    expect(screen.getByText("Email Address")).toBeInTheDocument();
    expect(screen.getByText("Plan Type")).toBeInTheDocument();
    expect(screen.getByText("userId")).toBeInTheDocument();
    expect(screen.getByText("Active Users")).toBeInTheDocument();
    expect(screen.getByText("Paying Customers")).toBeInTheDocument();
    expect(screen.queryByText("Private Segment")).not.toBeInTheDocument();
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
    // ... assertions ...
    expect(screen.getByText("Email Address")).toBeInTheDocument();
    expect(screen.queryByText("Plan Type")).not.toBeInTheDocument();
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
    // ... assertions ...
    expect(attributesTabButton).toHaveTextContent("environments.segments.person_and_attributes (Active)");
    expect(screen.getByText("common.user_id")).toBeInTheDocument();

    // Switch to Segments tab
    const segmentsTabButton = screen.getByTestId("tab-segments");
    await user.click(segmentsTabButton);
    // ... assertions ...
    expect(segmentsTabButton).toHaveTextContent("common.segments (Active)");
    expect(screen.getByText("Active Users")).toBeInTheDocument();

    // Switch to Devices tab
    const devicesTabButton = screen.getByTestId("tab-devices");
    await user.click(devicesTabButton);
    // ... assertions ...
    expect(devicesTabButton).toHaveTextContent("environments.segments.devices (Active)");
    expect(screen.getByText("environments.segments.phone")).toBeInTheDocument();
  });

  // --- Click and Keydown Tests ---

  const testFilterInteraction = async (
    elementFinder: () => HTMLElement,
    expectedType: string,
    expectedRoot: object,
    expectedQualifierOp: string,
    expectedValue: string | undefined
  ) => {
    // Test Click
    const elementClick = elementFinder();
    await user.click(elementClick);
    expect(onAddFilter).toHaveBeenCalledTimes(1);
    expectFilterPayload(
      onAddFilter.mock.calls[0],
      expectedType,
      expectedRoot,
      expectedQualifierOp,
      expectedValue
    );
    expect(setOpen).toHaveBeenCalledWith(false);
    onAddFilter.mockClear();
    setOpen.mockClear();

    // Test Enter Keydown
    const elementEnter = elementFinder();
    elementEnter.focus();
    await user.keyboard("{Enter}");
    expect(onAddFilter).toHaveBeenCalledTimes(1);
    expectFilterPayload(
      onAddFilter.mock.calls[0],
      expectedType,
      expectedRoot,
      expectedQualifierOp,
      expectedValue
    );
    expect(setOpen).toHaveBeenCalledWith(false);
    onAddFilter.mockClear();
    setOpen.mockClear();

    // Test Space Keydown
    const elementSpace = elementFinder();
    elementSpace.focus();
    await user.keyboard(" ");
    expect(onAddFilter).toHaveBeenCalledTimes(1);
    expectFilterPayload(
      onAddFilter.mock.calls[0],
      expectedType,
      expectedRoot,
      expectedQualifierOp,
      expectedValue
    );
    expect(setOpen).toHaveBeenCalledWith(false);
    onAddFilter.mockClear();
    setOpen.mockClear();
  };

  describe("All Tab Interactions", () => {
    beforeEach(() => {
      render(
        <AddFilterModal
          open={true}
          setOpen={setOpen}
          onAddFilter={onAddFilter}
          contactAttributeKeys={mockContactAttributeKeys}
          segments={mockSegments}
        />
      );
    });

    test("handles Person (userId) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByText("userId"),
        "person",
        { personIdentifier: "userId" },
        "equals",
        ""
      );
    });

    test("handles Attribute (Email Address) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByText("Email Address"),
        "attribute",
        { contactAttributeKey: "email" },
        "equals",
        ""
      );
    });

    test("handles Attribute (Plan Type) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByText("Plan Type"),
        "attribute",
        { contactAttributeKey: "plan" },
        "equals",
        ""
      );
    });

    test("handles Segment (Active Users) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByText("Active Users"),
        "segment",
        { segmentId: "seg1" },
        "userIsIn",
        "seg1"
      );
    });

    test("handles Segment (Paying Customers) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByText("Paying Customers"),
        "segment",
        { segmentId: "seg2" },
        "userIsIn",
        "seg2"
      );
    });

    test("handles Device (Phone) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByText("environments.segments.phone"),
        "device",
        { deviceType: "phone" },
        "equals",
        "phone"
      );
    });

    test("handles Device (Desktop) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByText("environments.segments.desktop"),
        "device",
        { deviceType: "desktop" },
        "equals",
        "desktop"
      );
    });
  });

  describe("Attributes Tab Interactions", () => {
    beforeEach(async () => {
      render(
        <AddFilterModal
          open={true}
          setOpen={setOpen}
          onAddFilter={onAddFilter}
          contactAttributeKeys={mockContactAttributeKeys}
          segments={mockSegments}
        />
      );
      await user.click(screen.getByTestId("tab-attributes"));
      await waitFor(() => expect(screen.getByTestId("tab-attributes")).toHaveTextContent("(Active)"));
    });

    test("handles Person (userId) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByTestId("person-filter-item"), // Use testid from component
        "person",
        { personIdentifier: "userId" },
        "equals",
        ""
      );
    });

    test("handles Attribute (Email Address) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByText("Email Address"),
        "attribute",
        { contactAttributeKey: "Email Address" }, // Uses name in this tab
        "equals",
        ""
      );
    });

    test("handles Attribute (Plan Type) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByText("Plan Type"),
        "attribute",
        { contactAttributeKey: "Plan Type" }, // Uses name in this tab
        "equals",
        ""
      );
    });
  });

  describe("Segments Tab Interactions", () => {
    beforeEach(async () => {
      render(
        <AddFilterModal
          open={true}
          setOpen={setOpen}
          onAddFilter={onAddFilter}
          contactAttributeKeys={mockContactAttributeKeys}
          segments={mockSegments}
        />
      );
      await user.click(screen.getByTestId("tab-segments"));
      await waitFor(() => expect(screen.getByTestId("tab-segments")).toHaveTextContent("(Active)"));
    });

    test("handles Segment (Active Users) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByText("Active Users"),
        "segment",
        { segmentId: "seg1" },
        "userIsIn",
        "seg1"
      );
    });

    test("handles Segment (Paying Customers) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByText("Paying Customers"),
        "segment",
        { segmentId: "seg2" },
        "userIsIn",
        "seg2"
      );
    });
  });

  describe("Devices Tab Interactions", () => {
    beforeEach(async () => {
      render(
        <AddFilterModal
          open={true}
          setOpen={setOpen}
          onAddFilter={onAddFilter}
          contactAttributeKeys={mockContactAttributeKeys}
          segments={mockSegments}
        />
      );
      await user.click(screen.getByTestId("tab-devices"));
      await waitFor(() => expect(screen.getByTestId("tab-devices")).toHaveTextContent("(Active)"));
    });

    test("handles Device (Phone) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByText("environments.segments.phone"),
        "device",
        { deviceType: "phone" },
        "equals",
        "phone"
      );
    });

    test("handles Device (Desktop) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByText("environments.segments.desktop"),
        "device",
        { deviceType: "desktop" },
        "equals",
        "desktop"
      );
    });
  });

  // --- Edge Case Tests ---
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
    await user.click(screen.getByTestId("tab-attributes"));
    expect(await screen.findByText("environments.segments.no_attributes_yet")).toBeInTheDocument();
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
    await user.click(screen.getByTestId("tab-segments"));
    expect(await screen.findByText("environments.segments.no_segments_yet")).toBeInTheDocument();
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
    expect(await screen.findByText("environments.segments.no_filters_yet")).toBeInTheDocument();
  });
});
