import { SegmentFilter } from "@/modules/ee/contacts/segments/components/segment-filter";
import * as segmentUtils from "@/modules/ee/contacts/segments/lib/utils";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
// Added fireEvent
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import {
  TSegment,
  TSegmentAttributeFilter,
  TSegmentDeviceFilter,
  TSegmentFilters,
  // Use TSegmentFilters
  TSegmentPersonFilter,
  TSegmentSegmentFilter,
} from "@formbricks/types/segment";

// Mock ResizeObserver
const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

// Mock dependencies
vi.mock("@/lib/utils/strings", () => ({
  isCapitalized: vi.fn((str) => str === "Email"),
}));

vi.mock("@/modules/ee/contacts/segments/lib/utils", () => ({
  convertOperatorToText: vi.fn((op) => op),
  convertOperatorToTitle: vi.fn((op) => op),
  toggleFilterConnector: vi.fn(),
  updateContactAttributeKeyInFilter: vi.fn(),
  updateDeviceTypeInFilter: vi.fn(),
  updateFilterValue: vi.fn(),
  updateOperatorInFilter: vi.fn(),
  updatePersonIdentifierInFilter: vi.fn(),
  updateSegmentIdInFilter: vi.fn(),
  getOperatorOptions: vi.fn(() => []),
  validateFilterValue: vi.fn(() => ({ isValid: true, message: "" })),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) => (
    <button data-testid="dropdown-trigger" disabled={disabled}>
      {children}
    </button>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick, icon }: any) => (
    <button onClick={onClick}>
      {icon}
      {children}
    </button>
  ),
}));

// Remove the mock for Input component

vi.mock("./add-filter-modal", () => ({
  AddFilterModal: ({ open, setOpen, onAddFilter }: any) =>
    open ? (
      <div data-testid="add-filter-modal">
        <span>Add Filter Modal</span>
        <button onClick={() => onAddFilter({})}>Add</button>
        <hr />
        <button onClick={() => setOpen(false)}>Close</button>
      </div>
    ) : null,
}));

vi.mock("lucide-react", () => ({
  ArrowDownIcon: () => <div data-testid="arrow-down-icon">ArrowDown</div>,
  ArrowUpIcon: () => <div data-testid="arrow-up-icon">ArrowUp</div>,
  FingerprintIcon: () => <div data-testid="fingerprint-icon">Fingerprint</div>,
  MonitorSmartphoneIcon: () => <div data-testid="monitor-icon">Monitor</div>,
  MoreVertical: () => <div data-testid="more-vertical-icon">MoreVertical</div>,
  TagIcon: () => <div data-testid="tag-icon">Tag</div>,
  Trash2: () => <div data-testid="trash-icon">Trash</div>,
  Users2Icon: () => <div data-testid="users-icon">Users</div>,
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

const mockSetSegment = vi.fn();
const mockHandleAddFilterBelow = vi.fn();
const mockOnCreateGroup = vi.fn();
const mockOnDeleteFilter = vi.fn();
const mockOnMoveFilter = vi.fn();

const environmentId = "test-env-id";
const segment = {
  id: "seg1",
  environmentId,
  title: "Test Segment",
  isPrivate: false,
  filters: [] as TSegmentFilters,
  surveys: ["survey1"],
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as TSegment;
const segments: TSegment[] = [
  segment,
  {
    id: "seg2",
    environmentId,
    title: "Another Segment",
    isPrivate: false,
    filters: [] as TSegmentFilters,
    surveys: ["survey1"],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as TSegment,
];
const contactAttributeKeys: TContactAttributeKey[] = [
  {
    id: "attr1",
    key: "email",
    name: "Email",
    environmentId,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as TContactAttributeKey,
  {
    id: "attr2",
    key: "userId",
    name: "User ID",
    environmentId,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as TContactAttributeKey,
  {
    id: "attr3",
    key: "plan",
    name: "Plan",
    environmentId,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as TContactAttributeKey,
];

const baseProps = {
  environmentId,
  segment,
  segments,
  contactAttributeKeys,
  setSegment: mockSetSegment,
  handleAddFilterBelow: mockHandleAddFilterBelow,
  onCreateGroup: mockOnCreateGroup,
  onDeleteFilter: mockOnDeleteFilter,
  onMoveFilter: mockOnMoveFilter,
};

describe("SegmentFilter", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Remove the implementation that modifies baseProps.segment during the test.
    // vi.clearAllMocks() in afterEach handles mock reset.
  });

  describe("Attribute Filter", () => {
    const attributeFilterResource: TSegmentAttributeFilter = {
      id: "filter-attr-1",
      root: {
        type: "attribute",
        contactAttributeKey: "email",
      },
      qualifier: {
        operator: "equals",
      },
      value: "test@example.com",
    };
    const segmentWithAttributeFilter: TSegment = {
      ...segment,
      filters: [
        {
          id: "group-1",
          connector: "and",
          resource: attributeFilterResource,
        },
      ],
    };

    test("renders correctly", async () => {
      const currentProps = { ...baseProps, segment: segmentWithAttributeFilter };
      render(<SegmentFilter {...currentProps} connector="and" resource={attributeFilterResource} />);
      expect(screen.getByText("and")).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText("Email").closest("button")).toBeInTheDocument());
      await waitFor(() => expect(screen.getByText("equals").closest("button")).toBeInTheDocument());
      expect(screen.getByDisplayValue("test@example.com")).toBeInTheDocument();
      expect(screen.getByTestId("dropdown-trigger")).toBeInTheDocument();
      expect(screen.getByTestId("trash-icon")).toBeInTheDocument();
    });

    test("renders attribute key select correctly", async () => {
      const currentProps = { ...baseProps, segment: structuredClone(segmentWithAttributeFilter) };
      render(<SegmentFilter {...currentProps} connector="and" resource={attributeFilterResource} />);

      await waitFor(() => expect(screen.getByText("Email").closest("button")).toBeInTheDocument());

      expect(vi.mocked(segmentUtils.updateContactAttributeKeyInFilter)).not.toHaveBeenCalled();
      expect(mockSetSegment).not.toHaveBeenCalled();
    });

    test("renders operator select correctly", async () => {
      const currentProps = { ...baseProps, segment: structuredClone(segmentWithAttributeFilter) };
      render(<SegmentFilter {...currentProps} connector="and" resource={attributeFilterResource} />);

      await waitFor(() => expect(screen.getByText("equals").closest("button")).toBeInTheDocument());

      expect(vi.mocked(segmentUtils.updateOperatorInFilter)).not.toHaveBeenCalled();
      expect(mockSetSegment).not.toHaveBeenCalled();
    });

    test("handles value change", async () => {
      const initialSegment = structuredClone(segmentWithAttributeFilter);
      const currentProps = { ...baseProps, segment: initialSegment, setSegment: mockSetSegment };

      render(<SegmentFilter {...currentProps} connector="and" resource={attributeFilterResource} />);
      const valueInput = screen.getByDisplayValue("test@example.com");

      // Clear the input
      await userEvent.clear(valueInput);
      // Fire a single change event with the final value
      fireEvent.change(valueInput, { target: { value: "new@example.com" } });

      // Check the call to the update function (might be called once or twice by checkValueAndUpdate)
      await waitFor(() => {
        // Check if it was called AT LEAST once with the correct final value
        expect(vi.mocked(segmentUtils.updateFilterValue)).toHaveBeenCalledWith(
          expect.anything(),
          attributeFilterResource.id,
          "new@example.com"
        );
      });

      // Ensure the state update function was called
      expect(mockSetSegment).toHaveBeenCalled();
    });

    test("renders viewOnly mode correctly", async () => {
      const currentProps = { ...baseProps, segment: segmentWithAttributeFilter };
      render(
        <SegmentFilter {...currentProps} connector="and" resource={attributeFilterResource} viewOnly={true} />
      );
      expect(screen.getByText("and")).toHaveClass("cursor-not-allowed");
      await waitFor(() => expect(screen.getByText("Email").closest("button")).toBeDisabled());
      await waitFor(() => expect(screen.getByText("equals").closest("button")).toBeDisabled());
      expect(screen.getByDisplayValue("test@example.com")).toBeDisabled();
      expect(screen.getByTestId("dropdown-trigger")).toBeDisabled();
      expect(screen.getByTestId("trash-icon").closest("button")).toBeDisabled();
    });
  });

  describe("Person Filter", () => {
    const personFilterResource: TSegmentPersonFilter = {
      id: "filter-person-1",
      root: { type: "person", personIdentifier: "userId" },
      qualifier: { operator: "equals" },
      value: "person123",
    };
    const segmentWithPersonFilter: TSegment = {
      ...segment,
      filters: [{ id: "group-1", connector: "and", resource: personFilterResource }],
    };

    test("renders correctly", async () => {
      const currentProps = { ...baseProps, segment: segmentWithPersonFilter };
      render(<SegmentFilter {...currentProps} connector="or" resource={personFilterResource} />);
      expect(screen.getByText("or")).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText("userId").closest("button")).toBeInTheDocument());
      await waitFor(() => expect(screen.getByText("equals").closest("button")).toBeInTheDocument());
      expect(screen.getByDisplayValue("person123")).toBeInTheDocument();
    });

    test("renders operator select correctly", async () => {
      const currentProps = { ...baseProps, segment: structuredClone(segmentWithPersonFilter) };
      render(<SegmentFilter {...currentProps} connector="or" resource={personFilterResource} />);

      await waitFor(() => expect(screen.getByText("equals").closest("button")).toBeInTheDocument());

      expect(vi.mocked(segmentUtils.updateOperatorInFilter)).not.toHaveBeenCalled();
      expect(mockSetSegment).not.toHaveBeenCalled();
    });

    test("handles value change", async () => {
      const initialSegment = structuredClone(segmentWithPersonFilter);
      const currentProps = { ...baseProps, segment: initialSegment, setSegment: mockSetSegment };

      render(<SegmentFilter {...currentProps} connector="or" resource={personFilterResource} />);
      const valueInput = screen.getByDisplayValue("person123");

      // Clear the input
      await userEvent.clear(valueInput);
      // Fire a single change event with the final value
      fireEvent.change(valueInput, { target: { value: "person456" } });

      // Check the call to the update function (might be called once or twice by checkValueAndUpdate)
      await waitFor(() => {
        // Check if it was called AT LEAST once with the correct final value
        expect(vi.mocked(segmentUtils.updateFilterValue)).toHaveBeenCalledWith(
          expect.anything(),
          personFilterResource.id,
          "person456"
        );
      });
      // Ensure the state update function was called
      expect(mockSetSegment).toHaveBeenCalled();
    });
  });

  describe("Segment Filter", () => {
    const segmentFilterResource = {
      id: "filter-segment-1",
      root: { type: "segment", segmentId: "seg2" },
      qualifier: { operator: "userIsIn" },
    } as unknown as TSegmentSegmentFilter;
    const segmentWithSegmentFilter: TSegment = {
      ...segment,
      filters: [{ id: "group-1", connector: "and", resource: segmentFilterResource }],
    };

    test("renders correctly", async () => {
      const currentProps = { ...baseProps, segment: segmentWithSegmentFilter };
      render(<SegmentFilter {...currentProps} connector={null} resource={segmentFilterResource} />);
      expect(screen.getByText("environments.segments.where")).toBeInTheDocument();
      expect(screen.getByText("userIsIn")).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText("Another Segment").closest("button")).toBeInTheDocument());
    });

    test("renders segment select correctly", async () => {
      const currentProps = { ...baseProps, segment: structuredClone(segmentWithSegmentFilter) };
      render(<SegmentFilter {...currentProps} connector={null} resource={segmentFilterResource} />);

      await waitFor(() => expect(screen.getByText("Another Segment").closest("button")).toBeInTheDocument());

      expect(vi.mocked(segmentUtils.updateSegmentIdInFilter)).not.toHaveBeenCalled();
      expect(mockSetSegment).not.toHaveBeenCalled();
    });
  });

  describe("Device Filter", () => {
    const deviceFilterResource: TSegmentDeviceFilter = {
      id: "filter-device-1",
      root: { type: "device", deviceType: "desktop" },
      qualifier: { operator: "equals" },
      value: "desktop",
    };
    const segmentWithDeviceFilter: TSegment = {
      ...segment,
      filters: [{ id: "group-1", connector: "and", resource: deviceFilterResource }],
    };

    test("renders correctly", async () => {
      const currentProps = { ...baseProps, segment: segmentWithDeviceFilter };
      render(<SegmentFilter {...currentProps} connector="and" resource={deviceFilterResource} />);
      expect(screen.getByText("and")).toBeInTheDocument();
      expect(screen.getByText("Device")).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText("equals").closest("button")).toBeInTheDocument());
      await waitFor(() =>
        expect(screen.getByText("environments.segments.desktop").closest("button")).toBeInTheDocument()
      );
    });

    test("renders operator select correctly", async () => {
      const currentProps = { ...baseProps, segment: structuredClone(segmentWithDeviceFilter) };
      render(<SegmentFilter {...currentProps} connector="and" resource={deviceFilterResource} />);

      await waitFor(() => expect(screen.getByText("equals").closest("button")).toBeInTheDocument());

      expect(vi.mocked(segmentUtils.updateOperatorInFilter)).not.toHaveBeenCalled();
      expect(mockSetSegment).not.toHaveBeenCalled();
    });

    test("renders device type select correctly", async () => {
      const currentProps = { ...baseProps, segment: structuredClone(segmentWithDeviceFilter) };
      render(<SegmentFilter {...currentProps} connector="and" resource={deviceFilterResource} />);

      await waitFor(() =>
        expect(screen.getByText("environments.segments.desktop").closest("button")).toBeInTheDocument()
      );

      expect(vi.mocked(segmentUtils.updateDeviceTypeInFilter)).not.toHaveBeenCalled();
      expect(mockSetSegment).not.toHaveBeenCalled();
    });
  });

  test("toggles connector on click", async () => {
    const attributeFilterResource: TSegmentAttributeFilter = {
      id: "filter-attr-1",
      root: { type: "attribute", contactAttributeKey: "email" },
      qualifier: { operator: "equals" },
      value: "test@example.com",
    };
    const segmentWithAttributeFilter: TSegment = {
      ...segment,
      filters: [
        {
          id: "group-1",
          connector: "and",
          resource: attributeFilterResource,
        },
      ],
    };

    const currentProps = { ...baseProps, segment: structuredClone(segmentWithAttributeFilter) };

    render(<SegmentFilter {...currentProps} connector="and" resource={attributeFilterResource} />);
    const connectorSpan = screen.getByText("and");
    await userEvent.click(connectorSpan);
    expect(vi.mocked(segmentUtils.toggleFilterConnector)).toHaveBeenCalledWith(
      currentProps.segment.filters,
      attributeFilterResource.id,
      "or"
    );
    expect(mockSetSegment).toHaveBeenCalled();
  });

  test("does not toggle connector in viewOnly mode", async () => {
    const attributeFilterResource: TSegmentAttributeFilter = {
      id: "filter-attr-1",
      root: { type: "attribute", contactAttributeKey: "email" },
      qualifier: { operator: "equals" },
      value: "test@example.com",
    };
    const segmentWithAttributeFilter: TSegment = {
      ...segment,
      filters: [
        {
          id: "group-1",
          connector: "and",
          resource: attributeFilterResource,
        },
      ],
    };

    const currentProps = { ...baseProps, segment: segmentWithAttributeFilter };

    render(
      <SegmentFilter {...currentProps} connector="and" resource={attributeFilterResource} viewOnly={true} />
    );
    const connectorSpan = screen.getByText("and");
    await userEvent.click(connectorSpan);
    expect(vi.mocked(segmentUtils.toggleFilterConnector)).not.toHaveBeenCalled();
    expect(mockSetSegment).not.toHaveBeenCalled();
  });
});
