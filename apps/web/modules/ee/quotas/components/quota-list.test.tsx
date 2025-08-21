import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurveyQuota, TSurveyQuotaCreateInput } from "@formbricks/types/quota";
import { QuotaList } from "./quota-list";

// Mock the createQuotaAction
vi.mock("@/modules/ee/quotas/actions", () => ({
  createQuotaAction: (quota: TSurveyQuotaCreateInput) => {
    return {
      data: {
        ...quota,
      },
    };
  },
}));

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock @tolgee/react
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string, params?: any) => {
      if (key === "environments.surveys.edit.quotas.limited_to_x_responses") {
        return `Limited to ${params?.limit} responses`;
      }
      return key;
    },
  }),
}));

// Mock UI components
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, className, variant, size, ...props }: any) => (
    <button onClick={onClick} className={className} data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@radix-ui/react-dropdown-menu", () => ({
  Label: ({ children, className }: any) => <label className={className}>{children}</label>,
}));

describe("QuotaList", () => {
  const mockOnEdit = vi.fn();
  const mockDeleteQuota = vi.fn();

  const mockQuotas: TSurveyQuota[] = [
    {
      id: "quota1",
      surveyId: "survey1",
      name: "Test Quota 1",
      limit: 100,
      conditions: {
        connector: "and",
        criteria: [],
      },
      action: "endSurvey",
      endingCardId: null,
      countPartialSubmissions: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "quota2",
      surveyId: "survey1",
      name: "Test Quota 2",
      limit: 50,
      conditions: {
        connector: "or",
        criteria: [],
      },
      action: "continueSurvey",
      endingCardId: "ending1",
      countPartialSubmissions: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    mockOnEdit.mockClear();
    mockDeleteQuota.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders list of quotas", () => {
    render(<QuotaList quotas={mockQuotas} onEdit={mockOnEdit} deleteQuota={mockDeleteQuota} />);

    expect(screen.getByText("Test Quota 1")).toBeInTheDocument();
    expect(screen.getByText("Test Quota 2")).toBeInTheDocument();
    expect(screen.getByText("Limited to 100 responses")).toBeInTheDocument();
    expect(screen.getByText("Limited to 50 responses")).toBeInTheDocument();
  });

  test("formats quota limits with locale string", () => {
    const quotaWithLargeLimit: TSurveyQuota = {
      ...mockQuotas[0],
      limit: 1234567,
    };

    render(<QuotaList quotas={[quotaWithLargeLimit]} onEdit={mockOnEdit} deleteQuota={mockDeleteQuota} />);

    // Should call toLocaleString on the limit
    expect(screen.getByText("Limited to 1,234,567 responses")).toBeInTheDocument();
  });

  test("calls onEdit when quota item is clicked", async () => {
    const user = userEvent.setup();

    render(<QuotaList quotas={mockQuotas} onEdit={mockOnEdit} deleteQuota={mockDeleteQuota} />);

    const quotaItem = screen.getByText("Test Quota 1").closest("div");
    expect(quotaItem).toBeInTheDocument();

    await user.click(quotaItem!);

    expect(mockOnEdit).toHaveBeenCalledWith(mockQuotas[0]);
  });

  test("renders empty list when no quotas", () => {
    render(<QuotaList quotas={[]} onEdit={mockOnEdit} deleteQuota={mockDeleteQuota} />);

    expect(screen.queryByText("Test Quota 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Test Quota 2")).not.toBeInTheDocument();
  });

  test("renders quota items with correct styling classes", () => {
    render(<QuotaList quotas={mockQuotas} onEdit={mockOnEdit} deleteQuota={mockDeleteQuota} />);

    const quotaItems = screen
      .getAllByRole("button")
      .filter((button) => button.className?.includes("cursor-pointer"));

    quotaItems.forEach((item) => {
      expect(item).toHaveClass("cursor-pointer");
      expect(item).toHaveClass("rounded-lg");
      expect(item).toHaveClass("bg-slate-50");
    });
  });

  test("renders action buttons with correct variants", () => {
    render(<QuotaList quotas={mockQuotas} onEdit={mockOnEdit} deleteQuota={mockDeleteQuota} />);

    const actionButtons = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("data-variant") === "ghost");

    expect(actionButtons.length).toBeGreaterThan(0);

    actionButtons.forEach((button) => {
      expect(button).toHaveAttribute("data-variant", "ghost");
      expect(button).toHaveAttribute("data-size", "sm");
    });
  });

  test("handles quota with special characters in name", () => {
    const quotaWithSpecialChars: TSurveyQuota = {
      ...mockQuotas[0],
      name: "Test Quota with @#$%^&*()_+ characters",
    };

    render(<QuotaList quotas={[quotaWithSpecialChars]} onEdit={mockOnEdit} deleteQuota={mockDeleteQuota} />);

    expect(screen.getByText("Test Quota with @#$%^&*()_+ characters")).toBeInTheDocument();
  });
});
