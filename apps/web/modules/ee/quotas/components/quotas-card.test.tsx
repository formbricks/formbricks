import { deleteQuotaAction, getQuotaResponseCountAction } from "@/modules/ee/quotas/actions";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurveyQuota } from "@formbricks/types/quota";
import { TSurvey } from "@formbricks/types/surveys/types";
import { QuotasCard } from "./quotas-card";

// Mock server actions
vi.mock("@/modules/ee/quotas/actions", () => ({
  deleteQuotaAction: vi.fn(),
  getQuotaResponseCountAction: vi.fn(),
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
      if (params) {
        let result = key;
        Object.keys(params).forEach((param) => {
          result = result.replace(`{{${param}}}`, params[param]);
        });
        return result;
      }
      return key;
    },
  }),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

// Mock @formkit/auto-animate/react
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null, () => {}],
}));

// Mock Radix UI Collapsible
vi.mock("@radix-ui/react-collapsible", () => ({
  Root: ({ children, open, onOpenChange }: any) => (
    <div data-testid="collapsible-root" data-open={open} onClick={() => onOpenChange?.(!open)}>
      {children}
    </div>
  ),
  Trigger: ({ children, asChild }: any) =>
    asChild ? children : <button data-testid="collapsible-trigger">{children}</button>,
  Content: ({ children }: any) => <div data-testid="collapsible-content">{children}</div>,
}));

// Mock UI components
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, variant, size, disabled, loading }: any) => (
    <button
      data-testid="button"
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      disabled={disabled || loading}
      data-loading={loading}>
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/upgrade-prompt", () => ({
  UpgradePrompt: ({ title, description, buttons }: any) => (
    <div data-testid="upgrade-prompt">
      <h3>{title}</h3>
      <p>{description}</p>
      {buttons?.map((button: any, index: number) => (
        <a key={index} href={button.href} data-testid="upgrade-link">
          {button.text}
        </a>
      ))}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/confirmation-modal", () => ({
  ConfirmationModal: ({ open, title, text, onConfirm, buttonText, buttonLoading }: any) =>
    open ? (
      <div data-testid="confirmation-modal">
        <h3>{title}</h3>
        <p>{text}</p>
        <button
          data-testid="confirm-button"
          onClick={onConfirm}
          disabled={buttonLoading}
          data-loading={buttonLoading}>
          {buttonText}
        </button>
      </div>
    ) : null,
}));

vi.mock("@/modules/ui/components/delete-dialog", () => ({
  DeleteDialog: ({ open, onDelete, deleteWhat, text, isDeleting, setOpen, ...props }: any) =>
    open ? (
      <div data-testid="delete-quota-dialog" {...props}>
        <h3>Delete {deleteWhat}</h3>
        <p>{text}</p>
        <button data-testid="cancel-button" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button
          data-testid="confirm-delete-button"
          onClick={onDelete}
          disabled={isDeleting}
          data-loading={isDeleting}>
          Delete
        </button>
      </div>
    ) : null,
}));

// Mock child components
vi.mock("./quota-list", () => ({
  QuotaList: ({ quotas, onEdit, deleteQuota }: any) => (
    <div data-testid="quota-list">
      {quotas.map((quota: any) => (
        <div key={quota.id} data-testid={`quota-item-${quota.id}`}>
          <span>{quota.name}</span>
          <button data-testid={`edit-${quota.id}`} onClick={() => onEdit(quota)}>
            Edit
          </button>
          <button data-testid={`delete-${quota.id}`} onClick={() => deleteQuota(quota)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("./quota-modal", () => ({
  QuotaModal: ({ open, quota, onClose, setQuotaToDelete }: any) =>
    open ? (
      <div data-testid="quota-modal">
        <span data-testid="modal-quota-id">{quota?.id || "new"}</span>
        <button data-testid="modal-close" onClick={onClose}>
          Close
        </button>
        <button
          data-testid="modal-delete"
          onClick={() => {
            if (quota && setQuotaToDelete) {
              setQuotaToDelete(quota);
              onClose();
            }
          }}>
          Delete from Modal
        </button>
      </div>
    ) : null,
}));

describe("QuotasCard", () => {
  const mockSurvey: TSurvey = {
    id: "survey1",
    environmentId: "env1",
    questions: [
      {
        id: "q1",
        type: "openText",
        headline: { default: "Test question" },
        required: false,
        inputType: "text",
      },
    ],
  } as unknown as TSurvey;

  const mockQuotas: TSurveyQuota[] = [
    {
      id: "quota1",
      surveyId: "survey1",
      name: "Test Quota 1",
      limit: 100,
      logic: { connector: "and", conditions: [] },
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
      logic: { connector: "or", conditions: [] },
      action: "continueSurvey",
      endingCardId: "ending1",
      countPartialSubmissions: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders quotas card", () => {
    render(
      <QuotasCard localSurvey={mockSurvey} isQuotasAllowed={true} quotas={mockQuotas} hasResponses={false} />
    );

    expect(screen.getByTestId("collapsible-root")).toBeInTheDocument();
    expect(screen.getByText("common.quotas")).toBeInTheDocument();
    expect(screen.getByText("common.quotas_description")).toBeInTheDocument();
  });

  test("shows upgrade prompt when quotas not enabled", () => {
    render(<QuotasCard localSurvey={mockSurvey} isQuotasAllowed={false} quotas={[]} hasResponses={false} />);

    expect(screen.getByTestId("upgrade-prompt")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.quotas.upgrade_prompt_title")).toBeInTheDocument();
  });

  test("shows quota list when quotas enabled and quotas exist", () => {
    render(
      <QuotasCard localSurvey={mockSurvey} isQuotasAllowed={true} quotas={mockQuotas} hasResponses={false} />
    );

    expect(screen.getByTestId("quota-list")).toBeInTheDocument();
    expect(screen.getByTestId("quota-item-quota1")).toBeInTheDocument();
    expect(screen.getByTestId("quota-item-quota2")).toBeInTheDocument();
  });

  test("shows no quotas message when enabled but no quotas exist", () => {
    render(<QuotasCard localSurvey={mockSurvey} isQuotasAllowed={true} quotas={[]} hasResponses={false} />);

    expect(screen.getByText("environments.surveys.edit.quotas.add_quota")).toBeInTheDocument();
  });

  test("opens quota modal when add quota button is clicked (no existing quotas)", async () => {
    const user = userEvent.setup();

    render(<QuotasCard localSurvey={mockSurvey} isQuotasAllowed={true} quotas={[]} hasResponses={false} />);

    const addButton = screen.getByRole("button", { name: /environments.surveys.edit.quotas.add_quota/i });
    await user.click(addButton);

    expect(screen.getByTestId("quota-modal")).toBeInTheDocument();
    expect(screen.getByTestId("modal-quota-id")).toHaveTextContent("new");
  });

  test("opens quota modal when add quota button is clicked (with existing quotas)", async () => {
    const user = userEvent.setup();

    render(
      <QuotasCard localSurvey={mockSurvey} isQuotasAllowed={true} quotas={mockQuotas} hasResponses={false} />
    );

    const addButtons = screen.getAllByRole("button", { name: /environments.surveys.edit.quotas.add_quota/i });
    const addButton = addButtons[0]; // Should be the add button in the bottom section
    await user.click(addButton);

    expect(screen.getByTestId("quota-modal")).toBeInTheDocument();
    expect(screen.getByTestId("modal-quota-id")).toHaveTextContent("new");
  });

  test("opens quota modal for editing when edit is clicked", async () => {
    const user = userEvent.setup();

    render(
      <QuotasCard localSurvey={mockSurvey} isQuotasAllowed={true} quotas={mockQuotas} hasResponses={false} />
    );
    vi.mocked(getQuotaResponseCountAction).mockResolvedValue({ data: { count: 10 } });
    const editButton = screen.getByTestId("edit-quota1");
    await user.click(editButton);

    expect(screen.getByTestId("quota-modal")).toBeInTheDocument();
    expect(screen.getByTestId("modal-quota-id")).toHaveTextContent("quota1");
  });

  test("shows confirmation modal when delete is clicked", async () => {
    const user = userEvent.setup();

    render(
      <QuotasCard localSurvey={mockSurvey} isQuotasAllowed={true} quotas={mockQuotas} hasResponses={false} />
    );

    const deleteButton = screen.getByTestId("delete-quota1");
    await user.click(deleteButton);

    expect(screen.getByTestId("delete-quota-dialog")).toBeInTheDocument();
  });

  test("deletes quota when confirmed", async () => {
    const user = userEvent.setup();

    vi.mocked(deleteQuotaAction).mockResolvedValue({ data: mockQuotas[0], serverError: undefined });

    render(
      <QuotasCard localSurvey={mockSurvey} isQuotasAllowed={true} quotas={mockQuotas} hasResponses={false} />
    );

    // Click delete button
    const deleteButton = screen.getByTestId("delete-quota1");
    await user.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByTestId("confirm-delete-button");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(vi.mocked(deleteQuotaAction)).toHaveBeenCalledWith({
        quotaId: "quota1",
        surveyId: "survey1",
      });
    });
  });

  test("shows success toast on successful delete", async () => {
    const user = userEvent.setup();

    vi.mocked(deleteQuotaAction).mockResolvedValue({ data: mockQuotas[0], serverError: undefined });

    render(
      <QuotasCard localSurvey={mockSurvey} isQuotasAllowed={true} quotas={mockQuotas} hasResponses={false} />
    );

    const deleteButton = screen.getByTestId("delete-quota1");
    await user.click(deleteButton);

    const confirmButton = screen.getByTestId("confirm-delete-button");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        "environments.surveys.edit.quotas.quota_deleted_successfull_toast"
      );
    });
  });

  test("shows error toast on failed delete", async () => {
    const user = userEvent.setup();

    vi.mocked(deleteQuotaAction).mockResolvedValue({ serverError: "Failed" });

    render(
      <QuotasCard localSurvey={mockSurvey} isQuotasAllowed={true} quotas={mockQuotas} hasResponses={false} />
    );

    const deleteButton = screen.getByTestId("delete-quota1");
    await user.click(deleteButton);

    const confirmButton = screen.getByTestId("confirm-delete-button");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Failed");
    });
  });

  test("closes quota modal when onClose is called", async () => {
    const user = userEvent.setup();

    render(<QuotasCard localSurvey={mockSurvey} isQuotasAllowed={true} quotas={[]} hasResponses={false} />);

    // Open modal
    const addButton = screen.getByRole("button", { name: /environments.surveys.edit.quotas.add_quota/i });
    await user.click(addButton);

    expect(screen.getByTestId("quota-modal")).toBeInTheDocument();

    // Close modal
    const closeButton = screen.getByTestId("modal-close");
    await user.click(closeButton);

    expect(screen.queryByTestId("quota-modal")).not.toBeInTheDocument();
  });

  test("shows correct upgrade buttons for Formbricks Cloud", () => {
    render(
      <QuotasCard
        localSurvey={mockSurvey}
        isQuotasAllowed={false}
        isFormbricksCloud={true}
        quotas={[]}
        hasResponses={false}
      />
    );

    const upgradeLinks = screen.getAllByTestId("upgrade-link");
    expect(upgradeLinks[0]).toHaveTextContent("common.start_free_trial");
    expect(upgradeLinks[0]).toHaveAttribute("href", "/environments/env1/settings/billing");
  });

  test("shows correct upgrade buttons for self-hosted", () => {
    render(
      <QuotasCard
        localSurvey={mockSurvey}
        isQuotasAllowed={false}
        isFormbricksCloud={false}
        quotas={[]}
        hasResponses={false}
      />
    );

    const upgradeLinks = screen.getAllByTestId("upgrade-link");
    expect(upgradeLinks[0]).toHaveTextContent("common.request_trial_license");
    expect(upgradeLinks[0]).toHaveAttribute("href", "https://formbricks.com/upgrade-self-hosting-license");
  });

  test("toggles collapsible state", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <QuotasCard localSurvey={mockSurvey} isQuotasAllowed={true} quotas={mockQuotas} hasResponses={false} />
    );

    const collapsibleRoot = container.querySelector("[data-testid='collapsible-root']");
    expect(collapsibleRoot).toHaveAttribute("data-open", "false");

    await user.click(collapsibleRoot!);

    expect(collapsibleRoot).toHaveAttribute("data-open", "true");
  });

  test("handles quota deletion from modal", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <QuotasCard localSurvey={mockSurvey} isQuotasAllowed={true} quotas={mockQuotas} hasResponses={false} />
    );
    vi.mocked(getQuotaResponseCountAction).mockResolvedValue({ data: { count: 10 } });

    // Open edit modal - use container to be more specific
    const editButton = container.querySelector("[data-testid='edit-quota1']");
    await user.click(editButton!);

    // Delete from modal
    const modalDeleteButton = screen.getByTestId("modal-delete");
    await user.click(modalDeleteButton);

    // Should show delete dialog
    expect(screen.getByTestId("delete-quota-dialog")).toBeInTheDocument();
  });

  test("disables delete button when deletion is in progress", async () => {
    const user = userEvent.setup();

    // Make delete action slow
    vi.mocked(deleteQuotaAction).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: mockQuotas[0], serverError: undefined }), 1000)
        )
    );

    render(
      <QuotasCard localSurvey={mockSurvey} isQuotasAllowed={true} quotas={mockQuotas} hasResponses={false} />
    );

    const deleteButton = screen.getByTestId("delete-quota1");
    await user.click(deleteButton);

    const confirmButton = screen.getByTestId("confirm-delete-button");
    await user.click(confirmButton);

    // Button should be disabled while deletion is in progress
    expect(confirmButton).toHaveAttribute("data-loading", "true");
  });
});
