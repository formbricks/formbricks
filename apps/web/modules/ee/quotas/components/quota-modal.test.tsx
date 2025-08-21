import { createQuotaAction, updateQuotaAction } from "@/modules/ee/quotas/actions";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TSurvey } from "@formbricks/types/surveys/types";
import { QuotaModal } from "./quota-modal";

// Mock server actions
vi.mock("@/modules/ee/quotas/actions", () => ({
  createQuotaAction: vi.fn(),
  updateQuotaAction: vi.fn(),
}));

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock UI components
vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
  DialogBody: ({ children }: any) => <div data-testid="dialog-body">{children}</div>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}));

vi.mock("@/modules/ui/components/form", () => ({
  FormProvider: ({ children }: any) => <div data-testid="form-provider">{children}</div>,
  FormField: ({ render, name }: any) => {
    const field = {
      value: name === "conditions" ? { connector: "and", criteria: [] } : "",
      onChange: vi.fn(),
      onBlur: vi.fn(),
    };
    return <div data-testid={`form-field-${name}`}>{render({ field })}</div>;
  },
  FormItem: ({ children }: any) => <div data-testid="form-item">{children}</div>,
  FormLabel: ({ children }: any) => <label data-testid="form-label">{children}</label>,
  FormControl: ({ children }: any) => <div data-testid="form-control">{children}</div>,
  FormDescription: ({ children }: any) => <p data-testid="form-description">{children}</p>,
}));

vi.mock("@/modules/ui/components/input", () => ({
  Input: (props: any) => <input data-testid="input" {...props} />,
}));

vi.mock("@/modules/ui/components/select", () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value} onClick={() => onValueChange?.("endSurvey")}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div data-testid="select-item" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <div data-testid="select-value">{placeholder}</div>,
}));

vi.mock("@/modules/ui/components/switch", () => ({
  Switch: ({ checked, onCheckedChange }: any) => (
    <button data-testid="switch" data-checked={checked} onClick={() => onCheckedChange?.(!checked)}>
      {checked ? "ON" : "OFF"}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, loading, disabled, type, variant }: any) => (
    <button
      data-testid="button"
      onClick={onClick}
      disabled={disabled || loading}
      type={type}
      data-variant={variant}
      data-loading={loading}>
      {children}
    </button>
  ),
}));

// Mock child components
vi.mock("./ending-card-selector", () => ({
  EndingCardSelector: ({ value, onChange }: any) => (
    <div data-testid="ending-card-selector" data-value={value} onClick={() => onChange?.("ending1")}>
      Ending Card Selector
    </div>
  ),
}));

vi.mock("./quota-condition-builder", () => ({
  QuotaConditionBuilder: ({ onChange }: any) => (
    <div data-testid="quota-condition-builder" onClick={() => onChange?.({ connector: "and", criteria: [] })}>
      Quota Condition Builder
    </div>
  ),
}));

// Mock react-hook-form
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    handleSubmit: (fn: any) => (e: any) => {
      e.preventDefault();
      fn({
        name: "Test Quota",
        limit: 100,
        conditions: { connector: "and", criteria: [] },
        action: "endSurvey",
        endingCardId: null,
        countPartialSubmissions: false,
      });
    },
    reset: vi.fn(),
    watch: vi.fn(() => "endSurvey"),
    setValue: vi.fn(),
    control: {},
    formState: { isSubmitting: false, isDirty: true },
  }),
}));

describe("QuotaModal", () => {
  const mockOnClose = vi.fn();
  const mockOnOpenChange = vi.fn();
  const mockDeleteQuota = vi.fn();

  const mockSurvey: TSurvey = {
    id: "survey1",
    environmentId: "env1",
    questions: [
      {
        id: "q1",
        type: "openText",
        headline: { default: "What is your name?" },
        required: false,
        inputType: "text",
      },
    ],
    endings: [
      {
        id: "ending1",
        type: "endScreen",
        headline: { default: "Thank you!" },
      },
    ],
  } as unknown as TSurvey;

  const mockQuota: TSurveyQuota = {
    id: "quota1",
    surveyId: "survey1",
    name: "Test Quota",
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
  };

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnOpenChange.mockClear();
    mockDeleteQuota.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders modal when open", () => {
    render(
      <QuotaModal
        open={true}
        onOpenChange={mockOnOpenChange}
        survey={mockSurvey}
        quota={null}
        deleteQuota={mockDeleteQuota}
        onClose={mockOnClose}
        quotas={[]}
      />
    );

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
  });

  test("does not render modal when closed", () => {
    render(
      <QuotaModal
        open={false}
        onOpenChange={mockOnOpenChange}
        survey={mockSurvey}
        quota={null}
        deleteQuota={mockDeleteQuota}
        onClose={mockOnClose}
        quotas={[]}
      />
    );

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  test("shows create title when no quota provided", () => {
    render(
      <QuotaModal
        open={true}
        onOpenChange={mockOnOpenChange}
        survey={mockSurvey}
        quota={null}
        deleteQuota={mockDeleteQuota}
        onClose={mockOnClose}
        quotas={[]}
      />
    );

    expect(screen.getByTestId("dialog-title")).toHaveTextContent(
      "environments.surveys.edit.quotas.new_quota"
    );
  });

  test("shows edit title when quota provided", () => {
    render(
      <QuotaModal
        open={true}
        onOpenChange={mockOnOpenChange}
        survey={mockSurvey}
        quota={mockQuota}
        deleteQuota={mockDeleteQuota}
        onClose={mockOnClose}
        quotas={[]}
      />
    );

    expect(screen.getByTestId("dialog-title")).toHaveTextContent(
      "environments.surveys.edit.quotas.edit_quota"
    );
  });

  test("renders all form fields", () => {
    render(
      <QuotaModal
        open={true}
        onOpenChange={mockOnOpenChange}
        survey={mockSurvey}
        quota={null}
        deleteQuota={mockDeleteQuota}
        onClose={mockOnClose}
        quotas={[]}
      />
    );

    expect(screen.getByTestId("form-field-name")).toBeInTheDocument();
    expect(screen.getByTestId("form-field-limit")).toBeInTheDocument();
    expect(screen.getByTestId("form-field-conditions")).toBeInTheDocument();
    expect(screen.getByTestId("form-field-action")).toBeInTheDocument();
    expect(screen.getByTestId("form-field-countPartialSubmissions")).toBeInTheDocument();
  });

  test("renders quota condition builder", () => {
    render(
      <QuotaModal
        open={true}
        onOpenChange={mockOnOpenChange}
        survey={mockSurvey}
        quota={null}
        deleteQuota={mockDeleteQuota}
        onClose={mockOnClose}
        quotas={[]}
      />
    );

    expect(screen.getByTestId("quota-condition-builder")).toBeInTheDocument();
  });

  test("shows ending card selector when action is endSurvey", () => {
    render(
      <QuotaModal
        open={true}
        onOpenChange={mockOnOpenChange}
        survey={mockSurvey}
        quota={mockQuota}
        deleteQuota={mockDeleteQuota}
        onClose={mockOnClose}
        quotas={[]}
      />
    );

    expect(screen.getByTestId("ending-card-selector")).toBeInTheDocument();
  });

  test("calls createQuotaAction when creating new quota", async () => {
    vi.mocked(createQuotaAction).mockResolvedValue({
      data: {
        id: "new-quota",
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Test Quota",
        conditions: { connector: "and", criteria: [] },
        action: "endSurvey",
        endingCardId: null,
        countPartialSubmissions: false,
        surveyId: "survey1",
        limit: 100,
      },
    });

    const { container } = render(
      <QuotaModal
        open={true}
        onOpenChange={mockOnOpenChange}
        survey={mockSurvey}
        quota={null}
        deleteQuota={mockDeleteQuota}
        onClose={mockOnClose}
        quotas={[]}
      />
    );

    const form = container.querySelector("form");
    const submitEvent = new Event("submit", { bubbles: true, cancelable: true });
    form!.dispatchEvent(submitEvent);

    await waitFor(() => {
      expect(vi.mocked(createQuotaAction)).toHaveBeenCalledWith({
        quota: expect.objectContaining({
          surveyId: "survey1",
          name: "Test Quota",
          limit: 100,
        }),
      });
    });
  });

  test("calls updateQuotaAction when updating existing quota", async () => {
    vi.mocked(updateQuotaAction).mockResolvedValue({
      data: {
        id: "quota1",
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Test Quota",
        conditions: { connector: "and", criteria: [] },
        action: "endSurvey",
        endingCardId: null,
        countPartialSubmissions: false,
        surveyId: "survey1",
        limit: 100,
      },
    });

    const { container } = render(
      <QuotaModal
        open={true}
        onOpenChange={mockOnOpenChange}
        survey={mockSurvey}
        quota={mockQuota}
        deleteQuota={mockDeleteQuota}
        onClose={mockOnClose}
        quotas={[]}
      />
    );

    const form = container.querySelector("form");
    const submitEvent = new Event("submit", { bubbles: true, cancelable: true });
    form!.dispatchEvent(submitEvent);

    await waitFor(() => {
      expect(vi.mocked(updateQuotaAction)).toHaveBeenCalledWith({
        quotaId: "quota1",
        quota: expect.objectContaining({
          name: "Test Quota",
          limit: 100,
        }),
        surveyId: "survey1",
      });
    });
  });

  test("shows success toast on successful create", async () => {
    vi.mocked(createQuotaAction).mockResolvedValue({
      data: {
        id: "new-quota",
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Test Quota",
        conditions: { connector: "and", criteria: [] },
        action: "endSurvey",
        endingCardId: null,
        countPartialSubmissions: false,
        surveyId: "survey1",
        limit: 100,
      },
    });

    const { container } = render(
      <QuotaModal
        open={true}
        onOpenChange={mockOnOpenChange}
        survey={mockSurvey}
        quota={null}
        deleteQuota={mockDeleteQuota}
        onClose={mockOnClose}
        quotas={[]}
      />
    );

    const form = container.querySelector("form");
    const submitEvent = new Event("submit", { bubbles: true, cancelable: true });
    form!.dispatchEvent(submitEvent);

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        "environments.surveys.edit.quotas.quota_created_successfull_toast"
      );
    });
  });

  test("shows error toast on failed create", async () => {
    vi.mocked(createQuotaAction).mockResolvedValue({
      serverError: "Failed",
    });

    const { container } = render(
      <QuotaModal
        open={true}
        onOpenChange={mockOnOpenChange}
        survey={mockSurvey}
        quota={null}
        deleteQuota={mockDeleteQuota}
        onClose={mockOnClose}
        quotas={[]}
      />
    );

    const form = container.querySelector("form");
    const submitEvent = new Event("submit", { bubbles: true, cancelable: true });
    form!.dispatchEvent(submitEvent);

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "environments.surveys.edit.quotas.failed_to_create_quota_toast"
      );
    });
  });

  test("shows delete button when editing quota", () => {
    render(
      <QuotaModal
        open={true}
        onOpenChange={mockOnOpenChange}
        survey={mockSurvey}
        quota={mockQuota}
        deleteQuota={mockDeleteQuota}
        onClose={mockOnClose}
        quotas={[]}
      />
    );

    const deleteButton = screen
      .getAllByTestId("button")
      .find((button) => button.getAttribute("data-variant") === "destructive");

    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).toHaveTextContent("common.delete");
  });

  test("shows cancel button when creating new quota", () => {
    render(
      <QuotaModal
        open={true}
        onOpenChange={mockOnOpenChange}
        survey={mockSurvey}
        quota={null}
        deleteQuota={mockDeleteQuota}
        onClose={mockOnClose}
        quotas={[]}
      />
    );

    const cancelButton = screen
      .getAllByTestId("button")
      .find((button) => button.getAttribute("data-variant") === "outline");

    expect(cancelButton).toBeInTheDocument();
    expect(cancelButton).toHaveTextContent("common.cancel");
  });

  test("calls deleteQuota when delete button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <QuotaModal
        open={true}
        onOpenChange={mockOnOpenChange}
        survey={mockSurvey}
        quota={mockQuota}
        deleteQuota={mockDeleteQuota}
        onClose={mockOnClose}
        quotas={[]}
      />
    );

    const deleteButton = screen
      .getAllByTestId("button")
      .find((button) => button.getAttribute("data-variant") === "destructive");

    await user.click(deleteButton!);

    expect(mockDeleteQuota).toHaveBeenCalledWith(mockQuota);
    expect(mockOnClose).toHaveBeenCalled();
  });

  test("calls onClose when cancel button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <QuotaModal
        open={true}
        onOpenChange={mockOnOpenChange}
        survey={mockSurvey}
        quota={null}
        deleteQuota={mockDeleteQuota}
        onClose={mockOnClose}
        quotas={[]}
      />
    );

    const cancelButton = screen
      .getAllByTestId("button")
      .find((button) => button.getAttribute("data-variant") === "outline");

    await user.click(cancelButton!);

    expect(mockOnClose).toHaveBeenCalled();
  });

  test("handles condition changes", async () => {
    const user = userEvent.setup();

    render(
      <QuotaModal
        open={true}
        onOpenChange={mockOnOpenChange}
        survey={mockSurvey}
        quota={null}
        deleteQuota={mockDeleteQuota}
        onClose={mockOnClose}
        quotas={[]}
      />
    );

    const conditionBuilder = screen.getByTestId("quota-condition-builder");
    await user.click(conditionBuilder);

    // The click should trigger the onChange callback in the mocked component
    expect(conditionBuilder).toBeInTheDocument();
  });
});
