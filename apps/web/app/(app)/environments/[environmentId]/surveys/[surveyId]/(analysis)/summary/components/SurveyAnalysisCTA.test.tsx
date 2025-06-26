import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { SurveyAnalysisCTA } from "./SurveyAnalysisCTA";

vi.mock("@/lib/utils/action-client-middleware", () => ({
  checkAuthorizationUpdated: vi.fn(),
}));
vi.mock("@/modules/ee/audit-logs/lib/utils", () => ({
  withAuditLogging: vi.fn((...args: any[]) => {
    // Check if the last argument is a function and return it directly
    if (typeof args[args.length - 1] === "function") {
      return args[args.length - 1];
    }
    // Otherwise, return a new function that takes a function as an argument and returns it
    return (fn: any) => fn;
  }),
}));

const mockPublicDomain = "https://public-domain.com";

// Mock constants
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  ENCRYPTION_KEY: "test",
  ENTERPRISE_LICENSE_KEY: "test",
  GITHUB_ID: "test",
  GITHUB_SECRET: "test",
  GOOGLE_CLIENT_ID: "test",
  GOOGLE_CLIENT_SECRET: "test",
  AZUREAD_CLIENT_ID: "mock-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "mock-azure-client-secret",
  AZUREAD_TENANT_ID: "mock-azuread-tenant-id",
  OIDC_CLIENT_ID: "mock-oidc-client-id",
  OIDC_CLIENT_SECRET: "mock-oidc-client-secret",
  OIDC_ISSUER: "mock-oidc-issuer",
  OIDC_DISPLAY_NAME: "mock-oidc-display-name",
  OIDC_SIGNING_ALGORITHM: "mock-oidc-signing-algorithm",
  WEBAPP_URL: "mock-webapp-url",
  IS_PRODUCTION: true,
  FB_LOGO_URL: "https://example.com/mock-logo.png",
  SMTP_HOST: "mock-smtp-host",
  SMTP_PORT: "mock-smtp-port",
  IS_POSTHOG_CONFIGURED: true,
  AUDIT_LOG_ENABLED: true,
  SESSION_MAX_AGE: 1000,
  REDIS_URL: "mock-url",
}));

vi.mock("@/lib/env", () => ({
  env: {
    PUBLIC_URL: "https://public-domain.com",
  },
}));

// Create a spy for refreshSingleUseId so we can override it in tests
const refreshSingleUseIdSpy = vi.fn(() => Promise.resolve("newSingleUseId"));

// Mock useSingleUseId hook
vi.mock("@/modules/survey/hooks/useSingleUseId", () => ({
  useSingleUseId: () => ({
    refreshSingleUseId: refreshSingleUseIdSpy,
  }),
}));

const mockSearchParams = new URLSearchParams();
const mockPush = vi.fn();
const mockReplace = vi.fn();

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/current-path",
}));

// Mock copySurveyLink to return a predictable string
vi.mock("@/modules/survey/lib/client-utils", () => ({
  copySurveyLink: vi.fn((url: string, suId: string) => `${url}?suId=${suId}`),
}));

// Mock the copy survey action
const mockCopySurveyToOtherEnvironmentAction = vi.fn();
vi.mock("@/modules/survey/list/actions", () => ({
  copySurveyToOtherEnvironmentAction: (args: any) => mockCopySurveyToOtherEnvironmentAction(args),
}));

// Mock getFormattedErrorMessage function
vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn((response) => response?.error || "Unknown error"),
}));

// Mock ResponseCountProvider dependencies
vi.mock("@/app/(app)/environments/[environmentId]/components/ResponseFilterContext", () => ({
  useResponseFilter: vi.fn(() => ({ selectedFilter: "all", dateRange: {} })),
}));

vi.mock("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions", () => ({
  getResponseCountAction: vi.fn(() => Promise.resolve({ data: 5 })),
}));

vi.mock("@/app/lib/surveys/surveys", () => ({
  getFormattedFilters: vi.fn(() => []),
}));

vi.mock("@/app/share/[sharingKey]/actions", () => ({
  getResponseCountBySurveySharingKeyAction: vi.fn(() => Promise.resolve({ data: 5 })),
}));

vi.mock("@/lib/getPublicUrl", () => ({
  getPublicDomain: vi.fn(() => mockPublicDomain),
}));

vi.spyOn(toast, "success");
vi.spyOn(toast, "error");

// Mock clipboard API
const writeTextMock = vi.fn().mockImplementation(() => Promise.resolve());

// Define it at the global level
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: writeTextMock },
  configurable: true,
});

const dummySurvey = {
  id: "survey123",
  type: "link",
  environmentId: "env123",
  status: "inProgress",
  resultShareKey: null,
} as unknown as TSurvey;

const dummyAppSurvey = {
  id: "survey123",
  type: "app",
  environmentId: "env123",
  status: "inProgress",
} as unknown as TSurvey;

const dummyEnvironment = { id: "env123", appSetupCompleted: true } as TEnvironment;
const dummyUser = { id: "user123", name: "Test User" } as TUser;

describe("SurveyAnalysisCTA", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSearchParams.delete("share"); // reset params
  });

  afterEach(() => {
    cleanup();
  });

  describe("Edit functionality", () => {
    test("opens EditPublicSurveyAlertDialog when edit icon is clicked and response count > 0", async () => {
      render(
        <SurveyAnalysisCTA
          survey={dummySurvey}
          environment={dummyEnvironment}
          isReadOnly={false}
          publicDomain={mockPublicDomain}
          user={dummyUser}
          responseCount={5}
        />
      );

      // Find the edit button
      const editButton = screen.getByRole("button", { name: "common.edit" });
      await fireEvent.click(editButton);

      // Check if dialog is shown
      const dialogTitle = screen.getByText("environments.surveys.edit.caution_edit_published_survey");
      expect(dialogTitle).toBeInTheDocument();
    });

    test("navigates directly to edit page when response count = 0", async () => {
      render(
        <SurveyAnalysisCTA
          survey={dummySurvey}
          environment={dummyEnvironment}
          isReadOnly={false}
          publicDomain={mockPublicDomain}
          user={dummyUser}
          responseCount={0}
        />
      );

      // Find the edit button
      const editButton = screen.getByRole("button", { name: "common.edit" });
      await fireEvent.click(editButton);

      // Should navigate directly to edit page
      expect(mockPush).toHaveBeenCalledWith(
        `/environments/${dummyEnvironment.id}/surveys/${dummySurvey.id}/edit`
      );
    });

    test("doesn't show edit button when isReadOnly is true", () => {
      render(
        <SurveyAnalysisCTA
          survey={dummySurvey}
          environment={dummyEnvironment}
          isReadOnly={true}
          publicDomain={mockPublicDomain}
          user={dummyUser}
          responseCount={5}
        />
      );

      const editButton = screen.queryByRole("button", { name: "common.edit" });
      expect(editButton).not.toBeInTheDocument();
    });
  });

  describe("Duplicate functionality", () => {
    test("duplicates survey and redirects on primary button click", async () => {
      mockCopySurveyToOtherEnvironmentAction.mockResolvedValue({
        data: { id: "newSurvey456" },
      });

      render(
        <SurveyAnalysisCTA
          survey={dummySurvey}
          environment={dummyEnvironment}
          isReadOnly={false}
          publicDomain={mockPublicDomain}
          user={dummyUser}
          responseCount={5}
        />
      );

      const editButton = screen.getByRole("button", { name: "common.edit" });
      fireEvent.click(editButton);

      const primaryButton = await screen.findByText("environments.surveys.edit.caution_edit_duplicate");
      fireEvent.click(primaryButton);

      await waitFor(() => {
        expect(mockCopySurveyToOtherEnvironmentAction).toHaveBeenCalledWith({
          environmentId: "env123",
          surveyId: "survey123",
          targetEnvironmentId: "env123",
        });
        expect(mockPush).toHaveBeenCalledWith("/environments/env123/surveys/newSurvey456/edit");
        expect(toast.success).toHaveBeenCalledWith("environments.surveys.survey_duplicated_successfully");
      });
    });

    test("shows error toast on duplication failure", async () => {
      const error = { error: "Duplication failed" };
      mockCopySurveyToOtherEnvironmentAction.mockResolvedValue(error);
      render(
        <SurveyAnalysisCTA
          survey={dummySurvey}
          environment={dummyEnvironment}
          isReadOnly={false}
          publicDomain={mockPublicDomain}
          user={dummyUser}
          responseCount={5}
        />
      );

      const editButton = screen.getByRole("button", { name: "common.edit" });
      fireEvent.click(editButton);

      const primaryButton = await screen.findByText("environments.surveys.edit.caution_edit_duplicate");
      fireEvent.click(primaryButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Duplication failed");
      });
    });
  });

  describe("Share button and modal", () => {
    test("opens share modal when 'Share survey' button is clicked", async () => {
      render(
        <SurveyAnalysisCTA
          survey={dummySurvey}
          environment={dummyEnvironment}
          isReadOnly={false}
          publicDomain={mockPublicDomain}
          user={dummyUser}
          responseCount={5}
        />
      );

      const shareButton = screen.getByText("environments.surveys.summary.share_survey");
      fireEvent.click(shareButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/current-path?share=true");
      });
    });

    test("renders ShareEmbedSurvey component when share modal is open", async () => {
      mockSearchParams.set("share", "true");
      render(
        <SurveyAnalysisCTA
          survey={dummySurvey}
          environment={dummyEnvironment}
          isReadOnly={false}
          publicDomain={mockPublicDomain}
          user={dummyUser}
          responseCount={5}
        />
      );

      // Assuming ShareEmbedSurvey renders a dialog with a specific title when open
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toBeInTheDocument();
    });
  });

  describe("General UI and visibility", () => {
    test("shows public results badge when resultShareKey is present", () => {
      const surveyWithShareKey = { ...dummySurvey, resultShareKey: "someKey" } as TSurvey;
      render(
        <SurveyAnalysisCTA
          survey={surveyWithShareKey}
          environment={dummyEnvironment}
          isReadOnly={false}
          publicDomain={mockPublicDomain}
          user={dummyUser}
          responseCount={5}
        />
      );

      expect(screen.getByText("environments.surveys.summary.results_are_public")).toBeInTheDocument();
    });

    test("shows SurveyStatusDropdown for non-draft surveys", () => {
      render(
        <SurveyAnalysisCTA
          survey={dummySurvey}
          environment={dummyEnvironment}
          isReadOnly={false}
          publicDomain={mockPublicDomain}
          user={dummyUser}
          responseCount={5}
        />
      );

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    test("does not show SurveyStatusDropdown for draft surveys", () => {
      const draftSurvey = { ...dummySurvey, status: "draft" } as TSurvey;
      render(
        <SurveyAnalysisCTA
          survey={draftSurvey}
          environment={dummyEnvironment}
          isReadOnly={false}
          publicDomain={mockPublicDomain}
          user={dummyUser}
          responseCount={5}
        />
      );
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });

    test("hides status dropdown and edit actions when isReadOnly is true", () => {
      render(
        <SurveyAnalysisCTA
          survey={dummySurvey}
          environment={dummyEnvironment}
          isReadOnly={true}
          publicDomain={mockPublicDomain}
          user={dummyUser}
          responseCount={5}
        />
      );

      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "common.edit" })).not.toBeInTheDocument();
    });

    test("shows preview button for link surveys", () => {
      render(
        <SurveyAnalysisCTA
          survey={dummySurvey}
          environment={dummyEnvironment}
          isReadOnly={false}
          publicDomain={mockPublicDomain}
          user={dummyUser}
          responseCount={5}
        />
      );
      expect(screen.getByRole("button", { name: "common.preview" })).toBeInTheDocument();
    });

    test("hides preview button for app surveys", () => {
      render(
        <SurveyAnalysisCTA
          survey={dummyAppSurvey}
          environment={dummyEnvironment}
          isReadOnly={false}
          publicDomain={mockPublicDomain}
          user={dummyUser}
          responseCount={5}
        />
      );
      expect(screen.queryByRole("button", { name: "common.preview" })).not.toBeInTheDocument();
    });
  });
});
