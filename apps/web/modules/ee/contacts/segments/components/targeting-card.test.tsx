import { TargetingCard } from "@/modules/ee/contacts/segments/components/targeting-card";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";

// Mock Data (Moved from mocks.ts)
const mockInitialSegment: TSegment = {
  id: "segment-1",
  title: "Initial Segment",
  description: "Initial segment description",
  isPrivate: false,
  filters: [
    {
      id: "base-filter-1", // ID for the base filter group/node
      connector: "and",
      resource: {
        // This holds the actual filter condition (TSegmentFilter)
        id: "segment-filter-1", // ID for the specific filter rule
        root: {
          type: "attribute",
          contactAttributeKey: "attr1",
        },
        qualifier: {
          operator: "equals",
        },
        value: "value1",
      },
    },
  ],
  surveys: ["survey-1"],
  environmentId: "test-env-id",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSurvey = {
  id: "survey-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Survey",
  type: "app", // Changed from "link" to "web"
  environmentId: "test-env-id",
  status: "inProgress",
  questions: [],
  displayOption: "displayOnce",
  recontactDays: 7,
  autoClose: null,
  closeOnDate: null,
  delay: 0,
  displayPercentage: 100,
  autoComplete: null,
  surveyClosedMessage: null,
  segment: mockInitialSegment,
  languages: [],
  triggers: [],
  pin: null,
  resultShareKey: null,
  welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
  singleUse: null,
  styling: null,
} as unknown as TSurvey;

const mockContactAttributeKeys: TContactAttributeKey[] = [
  { id: "attr1", description: "Desc 1", type: "default" } as unknown as TContactAttributeKey,
  { id: "attr2", description: "Desc 2", type: "default" } as unknown as TContactAttributeKey,
];

const mockSegments: TSegment[] = [
  mockInitialSegment,
  {
    id: "segment-2",
    title: "Segment 2",
    description: "Segment 2 description",
    isPrivate: true,
    filters: [],
    surveys: ["survey-2"],
    environmentId: "test-env-id",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
// End Mock Data

// Mock actions
const mockCloneSegmentAction = vi.fn();
const mockCreateSegmentAction = vi.fn();
const mockLoadNewSegmentAction = vi.fn();
const mockResetSegmentFiltersAction = vi.fn();
const mockUpdateSegmentAction = vi.fn();

vi.mock("@/modules/ee/contacts/segments/actions", () => ({
  cloneSegmentAction: (...args) => mockCloneSegmentAction(...args),
  createSegmentAction: (...args) => mockCreateSegmentAction(...args),
  loadNewSegmentAction: (...args) => mockLoadNewSegmentAction(...args),
  resetSegmentFiltersAction: (...args) => mockResetSegmentFiltersAction(...args),
  updateSegmentAction: (...args) => mockUpdateSegmentAction(...args),
}));

// Mock components
vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }) => <div>{children}</div>,
  AlertDescription: ({ children }) => <div>{children}</div>,
}));
vi.mock("@/modules/ui/components/alert-dialog", () => ({
  // Update the mock to render headerText
  AlertDialog: ({ children, open, headerText }) =>
    open ? (
      <div>
        AlertDialog Mock {headerText} {children}
      </div>
    ) : null,
}));
vi.mock("@/modules/ui/components/load-segment-modal", () => ({
  LoadSegmentModal: ({ open }) => (open ? <div>LoadSegmentModal Mock</div> : null),
}));
vi.mock("@/modules/ui/components/save-as-new-segment-modal", () => ({
  SaveAsNewSegmentModal: ({ open }) => (open ? <div>SaveAsNewSegmentModal Mock</div> : null),
}));
vi.mock("@/modules/ui/components/segment-title", () => ({
  SegmentTitle: ({ title, description }) => (
    <div>
      SegmentTitle Mock: {title} {description}
    </div>
  ),
}));
vi.mock("@/modules/ui/components/targeting-indicator", () => ({
  TargetingIndicator: () => <div>TargetingIndicator Mock</div>,
}));
vi.mock("./add-filter-modal", () => ({
  AddFilterModal: ({ open }) => (open ? <div>AddFilterModal Mock</div> : null),
}));
vi.mock("./segment-editor", () => ({
  SegmentEditor: ({ viewOnly }) => <div>SegmentEditor Mock {viewOnly ? "(View Only)" : "(Editable)"}</div>,
}));

// Mock hooks
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockSetLocalSurvey = vi.fn();
const environmentId = "test-env-id";

describe("TargetingCard", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    // Reset mocks before each test if needed
    mockCloneSegmentAction.mockResolvedValue({ data: { ...mockInitialSegment, id: "cloned-segment-id" } });
    mockResetSegmentFiltersAction.mockResolvedValue({ data: { ...mockInitialSegment, filters: [] } });
    mockUpdateSegmentAction.mockResolvedValue({ data: mockInitialSegment });
  });

  test("renders null for link surveys", () => {
    const linkSurvey: TSurvey = { ...mockSurvey, type: "link" };
    const { container } = render(
      <TargetingCard
        localSurvey={linkSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={environmentId}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
        initialSegment={mockInitialSegment}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  test("renders correctly for web/app surveys", () => {
    render(
      <TargetingCard
        localSurvey={mockSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={environmentId}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
        initialSegment={mockInitialSegment}
      />
    );
    expect(screen.getByText("environments.segments.target_audience")).toBeInTheDocument();
    expect(screen.getByText("environments.segments.pre_segment_users")).toBeInTheDocument();
  });

  test("opens and closes collapsible content", async () => {
    const user = userEvent.setup();
    render(
      <TargetingCard
        localSurvey={mockSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={environmentId}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
        initialSegment={mockInitialSegment}
      />
    );

    // Initially open because segment has filters
    expect(screen.getByText("TargetingIndicator Mock")).toBeVisible();

    // Click trigger to close (assuming it's open)
    await user.click(screen.getByText("environments.segments.target_audience"));
    // Check that the element is no longer in the document
    expect(screen.queryByText("TargetingIndicator Mock")).not.toBeInTheDocument();

    // Click trigger to open
    await user.click(screen.getByText("environments.segments.target_audience"));
    expect(screen.getByText("TargetingIndicator Mock")).toBeVisible();
  });

  test("opens Add Filter modal", async () => {
    const user = userEvent.setup();
    render(
      <TargetingCard
        localSurvey={{ ...mockSurvey, segment: { ...mockInitialSegment, isPrivate: true } }} // Start with editor open
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={environmentId}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
        initialSegment={mockInitialSegment}
      />
    );
    await user.click(screen.getByText("common.add_filter"));
    expect(screen.getByText("AddFilterModal Mock")).toBeInTheDocument();
  });

  test("opens Load Segment modal", async () => {
    const user = userEvent.setup();
    render(
      <TargetingCard
        localSurvey={mockSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={environmentId}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
        initialSegment={mockInitialSegment}
      />
    );
    await user.click(screen.getByText("environments.segments.load_segment"));
    expect(screen.getByText("LoadSegmentModal Mock")).toBeInTheDocument();
  });

  test("opens Reset All Filters confirmation dialog", async () => {
    const user = userEvent.setup();
    render(
      <TargetingCard
        localSurvey={mockSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={environmentId}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
        initialSegment={mockInitialSegment}
      />
    );
    await user.click(screen.getByText("environments.segments.reset_all_filters"));
    // Check that the mock container with the text exists
    expect(screen.getByText(/AlertDialog Mock\s*common.are_you_sure/)).toBeInTheDocument();
    // Use regex to find the specific text, ignoring whitespace
    expect(screen.getByText(/common\.are_you_sure/)).toBeInTheDocument();
  });

  test("toggles segment editor view", async () => {
    const user = userEvent.setup();
    render(
      <TargetingCard
        localSurvey={mockSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={environmentId}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
        initialSegment={mockInitialSegment}
      />
    );

    // Initially view only, editor is visible
    expect(screen.getByText("SegmentEditor Mock (View Only)")).toBeInTheDocument();
    expect(screen.getByText("environments.segments.hide_filters")).toBeInTheDocument();

    // Click to hide filters
    await user.click(screen.getByText("environments.segments.hide_filters"));
    // Editor should now be removed from the DOM
    expect(screen.queryByText("SegmentEditor Mock (View Only)")).not.toBeInTheDocument();
    // Button text should change to "View Filters"
    expect(screen.getByText("environments.segments.view_filters")).toBeInTheDocument();
    expect(screen.queryByText("environments.segments.hide_filters")).not.toBeInTheDocument();

    // Click again to show filters
    await user.click(screen.getByText("environments.segments.view_filters"));
    // Editor should be back in the DOM
    expect(screen.getByText("SegmentEditor Mock (View Only)")).toBeInTheDocument();
    // Button text should change back to "Hide Filters"
    expect(screen.getByText("environments.segments.hide_filters")).toBeInTheDocument();
    expect(screen.queryByText("environments.segments.view_filters")).not.toBeInTheDocument();
  });

  test("opens segment editor on 'Edit Segment' click", async () => {
    const user = userEvent.setup();
    render(
      <TargetingCard
        localSurvey={mockSurvey} // Segment used only in this survey
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={environmentId}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
        initialSegment={mockInitialSegment}
      />
    );

    expect(screen.getByText("SegmentEditor Mock (View Only)")).toBeInTheDocument();
    await user.click(screen.getByText("environments.segments.edit_segment"));
    expect(screen.getByText("SegmentEditor Mock (Editable)")).toBeInTheDocument();
    expect(screen.getByText("common.add_filter")).toBeInTheDocument(); // Editor controls visible
  });

  test("calls clone action on 'Clone and Edit Segment' click", async () => {
    const user = userEvent.setup();
    const surveyWithSharedSegment: TSurvey = {
      ...mockSurvey,
      segment: { ...mockInitialSegment, surveys: ["survey1", "survey2"] }, // Used in > 1 survey
    };
    render(
      <TargetingCard
        localSurvey={surveyWithSharedSegment}
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={environmentId}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
        initialSegment={{ ...mockInitialSegment, surveys: ["survey1", "survey2"] }}
      />
    );

    expect(
      screen.getByText("environments.segments.this_segment_is_used_in_other_surveys")
    ).toBeInTheDocument();
    await user.click(screen.getByText("environments.segments.clone_and_edit_segment"));
    expect(mockCloneSegmentAction).toHaveBeenCalledWith({
      segmentId: mockInitialSegment.id,
      surveyId: mockSurvey.id,
    });
    // Check if setSegment was called (indirectly via useEffect)
    // We need to wait for the promise to resolve and state update
    // await vi.waitFor(() => expect(mockSetLocalSurvey).toHaveBeenCalled()); // This might be tricky due to internal state
  });

  test("opens Save As New Segment modal when editor is open", async () => {
    const user = userEvent.setup();
    render(
      <TargetingCard
        localSurvey={{ ...mockSurvey, segment: { ...mockInitialSegment, isPrivate: true } }} // Start with editor open
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={environmentId}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
        initialSegment={mockInitialSegment}
      />
    );
    await user.click(screen.getByText("environments.segments.save_as_new_segment"));
    expect(screen.getByText("SaveAsNewSegmentModal Mock")).toBeInTheDocument();
  });

  test("calls update action on 'Save Changes' click (non-private segment)", async () => {
    const user = userEvent.setup();
    render(
      <TargetingCard
        localSurvey={mockSurvey} // Non-private segment
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={environmentId}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
        initialSegment={mockInitialSegment}
      />
    );

    // Open editor
    await user.click(screen.getByText("environments.segments.edit_segment"));
    expect(screen.getByText("SegmentEditor Mock (Editable)")).toBeInTheDocument();

    // Click save
    await user.click(screen.getByText("common.save_changes"));
    expect(mockUpdateSegmentAction).toHaveBeenCalledWith({
      segmentId: mockInitialSegment.id,
      environmentId: environmentId,
      data: { filters: mockInitialSegment.filters },
    });
  });

  test("closes editor on 'Cancel' click (non-private segment)", async () => {
    const user = userEvent.setup();
    render(
      <TargetingCard
        localSurvey={mockSurvey} // Non-private segment
        setLocalSurvey={mockSetLocalSurvey}
        environmentId={environmentId}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
        initialSegment={mockInitialSegment}
      />
    );

    // Open editor
    await user.click(screen.getByText("environments.segments.edit_segment"));
    expect(screen.getByText("SegmentEditor Mock (Editable)")).toBeInTheDocument();

    // Click cancel
    await user.click(screen.getByText("common.cancel"));
    expect(screen.getByText("SegmentEditor Mock (View Only)")).toBeInTheDocument();
    expect(screen.queryByText("common.add_filter")).not.toBeInTheDocument(); // Editor controls hidden
  });
});
