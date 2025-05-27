import { AddFilterModal } from "@/modules/ee/contacts/segments/components/add-filter-modal";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
// Added waitFor
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment } from "@formbricks/types/segment";

// Mock the Modal component
vi.mock("@/modules/ui/components/modal", () => ({
  Modal: ({
    children,
    open,
    closeOnOutsideClick,
    setOpen,
  }: {
    children: React.ReactNode;
    open: boolean;
    closeOnOutsideClick?: boolean;
    setOpen?: (open: boolean) => void;
  }) => {
    return open ? ( // NOSONAR // This is a mock
      <button
        data-testid="modal-overlay"
        onClick={(e) => {
          if (closeOnOutsideClick && e.target === e.currentTarget && setOpen) {
            setOpen(false);
          }
        }}>
        <div data-testid="modal-content">{children}</div>
      </button>
    ) : null; // NOSONAR // This is a mock
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
        () => screen.getByTestId("filter-btn-person-userId"),
        "person",
        { personIdentifier: "userId" },
        "equals",
        ""
      );
    });

    test("handles Attribute (Email Address) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByTestId("filter-btn-attribute-email"),
        "attribute",
        { contactAttributeKey: "email" },
        "equals",
        ""
      );
    });

    test("handles Attribute (Plan Type) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByTestId("filter-btn-attribute-plan"),
        "attribute",
        { contactAttributeKey: "plan" },
        "equals",
        ""
      );
    });

    test("handles Segment (Active Users) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByTestId("filter-btn-segment-seg1"),
        "segment",
        { segmentId: "seg1" },
        "userIsIn",
        "seg1"
      );
    });

    test("handles Segment (Paying Customers) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByTestId("filter-btn-segment-seg2"),
        "segment",
        { segmentId: "seg2" },
        "userIsIn",
        "seg2"
      );
    });

    test("handles Device (Phone) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByTestId("filter-btn-device-phone"),
        "device",
        { deviceType: "phone" },
        "equals",
        "phone"
      );
    });

    test("handles Device (Desktop) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByTestId("filter-btn-device-desktop"),
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
        () => screen.getByTestId("filter-btn-person-userId"),
        "person",
        { personIdentifier: "userId" },
        "equals",
        ""
      );
    });

    test("handles Attribute (Email Address) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByTestId("filter-btn-attribute-email"),
        "attribute",
        { contactAttributeKey: "email" },
        "equals",
        ""
      );
    });

    test("handles Attribute (Plan Type) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByTestId("filter-btn-attribute-plan"),
        "attribute",
        { contactAttributeKey: "plan" },
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
        () => screen.getByTestId("filter-btn-segment-seg1"),
        "segment",
        { segmentId: "seg1" },
        "userIsIn",
        "seg1"
      );
    });

    test("handles Segment (Paying Customers) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByTestId("filter-btn-segment-seg2"),
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
        () => screen.getByTestId("filter-btn-device-phone"),
        "device",
        { deviceType: "phone" },
        "equals",
        "phone"
      );
    });

    test("handles Device (Desktop) filter add (click/keydown)", async () => {
      await testFilterInteraction(
        () => screen.getByTestId("filter-btn-device-desktop"),
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

  test("verifies keyboard navigation through filter buttons", async () => {
    render(
      <AddFilterModal
        open={true}
        setOpen={setOpen}
        onAddFilter={onAddFilter}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
      />
    );

    // Get the search input to start tabbing from
    const searchInput = screen.getByPlaceholderText("Browse filters...");
    searchInput.focus();

    // Tab to the first tab button ("all")
    await user.tab();
    expect(document.activeElement).toHaveTextContent(/common\.all/);

    // Tab to the second tab button ("attributes")
    await user.tab();
    expect(document.activeElement).toHaveTextContent(/person_and_attributes/);

    // Tab to the third tab button ("segments")
    await user.tab();
    expect(document.activeElement).toHaveTextContent(/common\.segments/);

    // Tab to the fourth tab button ("devices")
    await user.tab();
    expect(document.activeElement).toHaveTextContent(/environments\.segments\.devices/);

    // Tab to the first filter button ("Email Address")
    await user.tab();
    expect(document.activeElement).toHaveTextContent("Email Address");

    // Tab to the second filter button ("Plan Type")
    await user.tab();
    expect(document.activeElement).toHaveTextContent("Plan Type");

    // Tab to the third filter button ("userId")
    await user.tab();
    expect(document.activeElement).toHaveTextContent("userId");
  });

  test("button elements are accessible to screen readers", () => {
    render(
      <AddFilterModal
        open={true}
        setOpen={setOpen}
        onAddFilter={onAddFilter}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
      />
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0); // Verify buttons exist

    // Check that buttons are focusable (they should be by default)
    buttons.forEach((button) => {
      expect(button).not.toHaveAttribute("aria-hidden", "true");
      expect(button).not.toHaveAttribute("tabIndex", "-1"); // Should not be unfocusable
    });
  });

  test("closes the modal when clicking outside the content area", async () => {
    render(
      <AddFilterModal
        open={true}
        setOpen={setOpen}
        onAddFilter={onAddFilter}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
      />
    );

    const modalOverlay = screen.getByTestId("modal-overlay");
    await user.click(modalOverlay);

    expect(setOpen).toHaveBeenCalledWith(false);
  });
});
