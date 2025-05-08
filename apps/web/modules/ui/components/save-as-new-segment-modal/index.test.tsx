import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SaveAsNewSegmentModal } from "./index";

// Mock react-hook-form
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    register: vi.fn().mockImplementation((name) => ({
      name,
      onChange: vi.fn(),
      onBlur: vi.fn(),
      ref: vi.fn(),
    })),
    handleSubmit: vi.fn().mockImplementation((fn) => (data) => {
      fn(data);
      return false;
    }),
    formState: { errors: {} },
    setValue: vi.fn(),
  }),
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  UsersIcon: () => <div data-testid="users-icon" />,
}));

// Mock Modal component
vi.mock("@/modules/ui/components/modal", () => ({
  Modal: ({ open, setOpen, noPadding, children }) => {
    if (!open) return null;
    return (
      <div data-testid="modal" data-no-padding={noPadding}>
        <button data-testid="modal-close" onClick={() => setOpen(false)}>
          Close
        </button>
        {children}
      </div>
    );
  },
}));

// Mock Button component
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, variant, onClick, type, loading }) => (
    <button
      data-testid={`button-${variant || "primary"}`}
      data-loading={loading}
      data-type={type}
      onClick={onClick}>
      {children}
    </button>
  ),
}));

// Mock Input component
vi.mock("@/modules/ui/components/input", () => ({
  Input: (props) => <input data-testid={`input-${props.name || "default"}`} {...props} />,
}));

// Mock the useTranslate hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key) => {
      const translations = {
        "environments.segments.save_as_new_segment": "Save as New Segment",
        "environments.segments.save_your_filters_as_a_segment_to_use_it_in_other_surveys":
          "Save your filters as a segment to use it in other surveys",
        "common.name": "Name",
        "environments.segments.ex_power_users": "Ex: Power Users",
        "common.description": "Description",
        "environments.segments.most_active_users_in_the_last_30_days":
          "Most active users in the last 30 days",
        "common.cancel": "Cancel",
        "common.save": "Save",
        "environments.segments.segment_created_successfully": "Segment created successfully",
        "environments.segments.segment_updated_successfully": "Segment updated successfully",
      };
      return translations[key] || key;
    },
  }),
}));

describe("SaveAsNewSegmentModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockProps = {
    open: true,
    setOpen: vi.fn(),
    localSurvey: {
      id: "survey1",
      environmentId: "env1",
    } as any,
    segment: {
      id: "segment1",
      isPrivate: false,
      filters: [{ id: "filter1" }],
    } as any,
    setSegment: vi.fn(),
    setIsSegmentEditorOpen: vi.fn(),
    onCreateSegment: vi.fn().mockResolvedValue({ id: "newSegment" }),
    onUpdateSegment: vi.fn().mockResolvedValue({ id: "updatedSegment" }),
  };

  test("renders the modal when open is true", () => {
    render(<SaveAsNewSegmentModal {...mockProps} />);

    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByText("Save as New Segment")).toBeInTheDocument();
    expect(screen.getByText("Save your filters as a segment to use it in other surveys")).toBeInTheDocument();
    expect(screen.getByTestId("users-icon")).toBeInTheDocument();
  });

  test("doesn't render when open is false", () => {
    render(<SaveAsNewSegmentModal {...mockProps} open={false} />);

    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });

  test("renders form fields correctly", () => {
    render(<SaveAsNewSegmentModal {...mockProps} />);

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByTestId("input-title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByTestId("input-description")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  test("calls setOpen with false when close button is clicked", async () => {
    const user = userEvent.setup();
    render(<SaveAsNewSegmentModal {...mockProps} />);

    await user.click(screen.getByTestId("modal-close"));

    expect(mockProps.setOpen).toHaveBeenCalledWith(false);
  });

  test("calls setOpen with false when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<SaveAsNewSegmentModal {...mockProps} />);

    await user.click(screen.getByText("Cancel"));

    expect(mockProps.setOpen).toHaveBeenCalledWith(false);
  });

  test("calls onCreateSegment when form is submitted with new segment", async () => {
    const user = userEvent.setup();
    const createProps = {
      ...mockProps,
      segment: {
        ...mockProps.segment,
        id: "temp", // indicates a new segment
      },
    };

    render(<SaveAsNewSegmentModal {...createProps} />);

    // Submit the form
    await user.click(screen.getByText("Save"));

    // Check that onCreateSegment was called
    expect(createProps.onCreateSegment).toHaveBeenCalled();
    expect(createProps.setSegment).toHaveBeenCalled();
    expect(createProps.setIsSegmentEditorOpen).toHaveBeenCalledWith(false);
    expect(createProps.setOpen).toHaveBeenCalledWith(false);
  });

  test("calls onUpdateSegment when form is submitted with an existing private segment", async () => {
    const user = userEvent.setup();
    const updateProps = {
      ...mockProps,
      segment: {
        ...mockProps.segment,
        isPrivate: true,
      },
    };

    render(<SaveAsNewSegmentModal {...updateProps} />);

    // Submit the form
    await user.click(screen.getByText("Save"));

    // Check that onUpdateSegment was called
    expect(updateProps.onUpdateSegment).toHaveBeenCalled();
    expect(updateProps.setSegment).toHaveBeenCalled();
    expect(updateProps.setIsSegmentEditorOpen).toHaveBeenCalledWith(false);
    expect(updateProps.setOpen).toHaveBeenCalledWith(false);
  });

  test("shows loading state on button during submission", async () => {
    // Use a delayed promise to check loading state
    const delayedPromise = new Promise<any>((resolve) => {
      setTimeout(() => resolve({ id: "newSegment" }), 100);
    });

    const loadingProps = {
      ...mockProps,
      segment: {
        ...mockProps.segment,
        id: "temp",
      },
      onCreateSegment: vi.fn().mockReturnValue(delayedPromise),
    };

    render(<SaveAsNewSegmentModal {...loadingProps} />);

    // Submit the form
    await userEvent.click(screen.getByText("Save"));

    // Button should show loading state
    const saveButton = screen.getByTestId("button-primary");
    expect(saveButton).toHaveAttribute("data-loading", "true");
  });
});
