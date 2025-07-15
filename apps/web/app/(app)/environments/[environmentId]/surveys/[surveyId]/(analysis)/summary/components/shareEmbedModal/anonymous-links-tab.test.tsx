import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { AnonymousLinksTab } from "./anonymous-links-tab";

// Mock actions
vi.mock("../../actions", () => ({
  updateSingleUseLinksAction: vi.fn(),
}));

vi.mock("@/modules/survey/list/actions", () => ({
  generateSingleUseIdsAction: vi.fn(),
}));

// Mock components
vi.mock("@/modules/analysis/components/ShareSurveyLink", () => ({
  ShareSurveyLink: ({ surveyUrl, publicDomain }: any) => (
    <div data-testid="share-survey-link">
      <p>Survey URL: {surveyUrl}</p>
      <p>Public Domain: {publicDomain}</p>
    </div>
  ),
}));

vi.mock("@/modules/ui/components/advanced-option-toggle", () => ({
  AdvancedOptionToggle: ({ children, htmlId, isChecked, onToggle, title }: any) => (
    <div data-testid={`toggle-${htmlId}`} data-checked={isChecked}>
      <button data-testid={`toggle-button-${htmlId}`} onClick={() => onToggle(!isChecked)}>
        {title}
      </button>
      {children}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children, variant, size }: any) => (
    <div data-testid={`alert-${variant}`} data-size={size}>
      {children}
    </div>
  ),
  AlertTitle: ({ children }: any) => <div data-testid="alert-title">{children}</div>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, disabled, variant }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/input", () => ({
  Input: ({ value, onChange, type, max, min, className }: any) => (
    <input
      type={type}
      max={max}
      min={min}
      className={className}
      value={value}
      onChange={onChange}
      data-testid="number-input"
    />
  ),
}));

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/tab-container",
  () => ({
    TabContainer: ({ children, title }: any) => (
      <div data-testid="tab-container">
        <h2>{title}</h2>
        {children}
      </div>
    ),
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/disable-link-modal",
  () => ({
    DisableLinkModal: ({ open, type, onDisable }: any) => (
      <div data-testid="disable-link-modal" data-open={open} data-type={type}>
        <button onClick={() => onDisable()}>Confirm</button>
        <button>Close</button>
      </div>
    ),
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/documentation-links",
  () => ({
    DocumentationLinks: ({ links }: any) => (
      <div data-testid="documentation-links">
        {links.map((link: any, index: number) => (
          <a key={index} href={link.href}>
            {link.title}
          </a>
        ))}
      </div>
    ),
  })
);

// Mock translations
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Mock Next.js router
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

// Mock toast
vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock URL and Blob for download functionality
global.URL.createObjectURL = vi.fn(() => "mock-url");
global.URL.revokeObjectURL = vi.fn();
global.Blob = vi.fn(() => ({}) as any);

describe("AnonymousLinksTab", () => {
  const mockSurvey = {
    id: "test-survey-id",
    environmentId: "test-env-id",
    type: "link" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Test Survey",
    createdBy: null,
    status: "draft" as const,
    questions: [],
    thankYouCard: { enabled: false },
    welcomeCard: { enabled: false },
    hiddenFields: { enabled: false },
    singleUse: {
      enabled: false,
      isEncrypted: false,
    },
  } as unknown as TSurvey;

  const surveyWithSingleUse = {
    ...mockSurvey,
    singleUse: {
      enabled: true,
      isEncrypted: false,
    },
  } as TSurvey;

  const surveyWithEncryption = {
    ...mockSurvey,
    singleUse: {
      enabled: true,
      isEncrypted: true,
    },
  } as TSurvey;

  const defaultProps = {
    survey: mockSurvey,
    surveyUrl: "https://example.com/survey",
    publicDomain: "https://example.com",
    setSurveyUrl: vi.fn(),
    locale: "en-US" as TUserLocale,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { updateSingleUseLinksAction } = await import("../../actions");
    const { generateSingleUseIdsAction } = await import("@/modules/survey/list/actions");

    vi.mocked(updateSingleUseLinksAction).mockResolvedValue({ data: mockSurvey });
    vi.mocked(generateSingleUseIdsAction).mockResolvedValue({ data: ["link1", "link2"] });
  });

  afterEach(() => {
    cleanup();
  });

  test("renders with multi-use link enabled by default", () => {
    render(<AnonymousLinksTab {...defaultProps} />);

    expect(screen.getByTestId("tab-container")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-multi-use-link-switch")).toHaveAttribute("data-checked", "true");
    expect(screen.getByTestId("toggle-single-use-link-switch")).toHaveAttribute("data-checked", "false");
  });

  test("renders with single-use link enabled when survey has singleUse enabled", () => {
    render(<AnonymousLinksTab {...defaultProps} survey={surveyWithSingleUse} />);

    expect(screen.getByTestId("toggle-multi-use-link-switch")).toHaveAttribute("data-checked", "false");
    expect(screen.getByTestId("toggle-single-use-link-switch")).toHaveAttribute("data-checked", "true");
  });

  test("handles multi-use toggle when single-use is disabled", async () => {
    const user = userEvent.setup();
    const { updateSingleUseLinksAction } = await import("../../actions");

    render(<AnonymousLinksTab {...defaultProps} />);

    // When multi-use is enabled and we click it, it should show a modal to turn it off
    const multiUseToggle = screen.getByTestId("toggle-button-multi-use-link-switch");
    await user.click(multiUseToggle);

    // Should show confirmation modal
    expect(screen.getByTestId("disable-link-modal")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("disable-link-modal")).toHaveAttribute("data-type", "multi-use");

    // Confirm the modal action
    const confirmButton = screen.getByText("Confirm");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(updateSingleUseLinksAction).toHaveBeenCalledWith({
        surveyId: "test-survey-id",
        environmentId: "test-env-id",
        isSingleUse: true,
        isSingleUseEncryption: true,
      });
    });

    expect(mockRefresh).toHaveBeenCalled();
  });

  test("shows confirmation modal when toggling from single-use to multi-use", async () => {
    const user = userEvent.setup();
    render(<AnonymousLinksTab {...defaultProps} survey={surveyWithSingleUse} />);

    const multiUseToggle = screen.getByTestId("toggle-button-multi-use-link-switch");
    await user.click(multiUseToggle);

    expect(screen.getByTestId("disable-link-modal")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("disable-link-modal")).toHaveAttribute("data-type", "single-use");
  });

  test("shows confirmation modal when toggling from multi-use to single-use", async () => {
    const user = userEvent.setup();
    render(<AnonymousLinksTab {...defaultProps} />);

    const singleUseToggle = screen.getByTestId("toggle-button-single-use-link-switch");
    await user.click(singleUseToggle);

    expect(screen.getByTestId("disable-link-modal")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("disable-link-modal")).toHaveAttribute("data-type", "multi-use");
  });

  test("handles single-use encryption toggle", async () => {
    const user = userEvent.setup();
    const { updateSingleUseLinksAction } = await import("../../actions");

    render(<AnonymousLinksTab {...defaultProps} survey={surveyWithSingleUse} />);

    const encryptionToggle = screen.getByTestId("toggle-button-single-use-encryption-switch");
    await user.click(encryptionToggle);

    await waitFor(() => {
      expect(updateSingleUseLinksAction).toHaveBeenCalledWith({
        surveyId: "test-survey-id",
        environmentId: "test-env-id",
        isSingleUse: true,
        isSingleUseEncryption: true,
      });
    });
  });

  test("shows encryption info alert when encryption is disabled", () => {
    render(<AnonymousLinksTab {...defaultProps} survey={surveyWithSingleUse} />);

    const alerts = screen.getAllByTestId("alert-info");
    const encryptionAlert = alerts.find(
      (alert) =>
        alert.querySelector('[data-testid="alert-title"]')?.textContent ===
        "environments.surveys.share.anonymous_links.custom_single_use_id_title"
    );

    expect(encryptionAlert).toBeInTheDocument();
    expect(encryptionAlert?.querySelector('[data-testid="alert-title"]')).toHaveTextContent(
      "environments.surveys.share.anonymous_links.custom_single_use_id_title"
    );
  });

  test("shows link generation section when encryption is enabled", () => {
    render(<AnonymousLinksTab {...defaultProps} survey={surveyWithEncryption} />);

    expect(screen.getByTestId("number-input")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.share.anonymous_links.generate_and_download_links")
    ).toBeInTheDocument();
  });

  test("handles number of links input change", async () => {
    const user = userEvent.setup();
    render(<AnonymousLinksTab {...defaultProps} survey={surveyWithEncryption} />);

    const input = screen.getByTestId("number-input");
    await user.clear(input);
    await user.type(input, "5");

    expect(input).toHaveValue(5);
  });

  test("handles link generation error", async () => {
    const user = userEvent.setup();
    const { generateSingleUseIdsAction } = await import("@/modules/survey/list/actions");
    vi.mocked(generateSingleUseIdsAction).mockResolvedValue({ data: undefined });

    render(<AnonymousLinksTab {...defaultProps} survey={surveyWithEncryption} />);

    const generateButton = screen.getByText(
      "environments.surveys.share.anonymous_links.generate_and_download_links"
    );
    await user.click(generateButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "environments.surveys.share.anonymous_links.generate_links_error"
      );
    });
  });

  test("handles action error with generic message", async () => {
    const user = userEvent.setup();
    const { updateSingleUseLinksAction } = await import("../../actions");
    vi.mocked(updateSingleUseLinksAction).mockResolvedValue({ data: undefined });

    render(<AnonymousLinksTab {...defaultProps} />);

    // Click multi-use toggle to show modal
    const multiUseToggle = screen.getByTestId("toggle-button-multi-use-link-switch");
    await user.click(multiUseToggle);

    // Confirm the modal action
    const confirmButton = screen.getByText("Confirm");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("common.something_went_wrong_please_try_again");
    });
  });

  test("confirms modal action when disable link modal is confirmed", async () => {
    const user = userEvent.setup();
    const { updateSingleUseLinksAction } = await import("../../actions");

    render(<AnonymousLinksTab {...defaultProps} survey={surveyWithSingleUse} />);

    const multiUseToggle = screen.getByTestId("toggle-button-multi-use-link-switch");
    await user.click(multiUseToggle);

    const confirmButton = screen.getByText("Confirm");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(updateSingleUseLinksAction).toHaveBeenCalledWith({
        surveyId: "test-survey-id",
        environmentId: "test-env-id",
        isSingleUse: false,
        isSingleUseEncryption: false,
      });
    });
  });

  test("renders documentation links", () => {
    render(<AnonymousLinksTab {...defaultProps} />);

    expect(screen.getByTestId("documentation-links")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.share.anonymous_links.single_use_links")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.share.anonymous_links.data_prefilling")
    ).toBeInTheDocument();
  });
});
