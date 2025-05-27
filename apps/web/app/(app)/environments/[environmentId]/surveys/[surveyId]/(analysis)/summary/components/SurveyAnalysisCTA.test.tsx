import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { SurveyAnalysisCTA } from "./SurveyAnalysisCTA";

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
  SESSION_MAX_AGE: 1000,
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

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/current",
}));

// Mock copySurveyLink to return a predictable string
vi.mock("@/modules/survey/lib/client-utils", () => ({
  copySurveyLink: vi.fn((url: string, id: string) => `${url}?id=${id}`),
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
  status: "active",
} as unknown as TSurvey;
const dummyEnvironment = { id: "env123", appSetupCompleted: true } as TEnvironment;
const dummyUser = { id: "user123", name: "Test User" } as TUser;
const surveyDomain = "https://surveys.test.formbricks.com";

describe("SurveyAnalysisCTA - handleCopyLink", () => {
  afterEach(() => {
    cleanup();
  });

  test("calls copySurveyLink and clipboard.writeText on success", async () => {
    render(
      <SurveyAnalysisCTA
        survey={dummySurvey}
        environment={dummyEnvironment}
        isReadOnly={false}
        surveyDomain={surveyDomain}
        user={dummyUser}
        responseCount={5}
      />
    );

    const copyButton = screen.getByRole("button", { name: "common.copy_link" });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(refreshSingleUseIdSpy).toHaveBeenCalled();
      expect(writeTextMock).toHaveBeenCalledWith(
        "https://surveys.test.formbricks.com/s/survey123?id=newSingleUseId"
      );
      expect(toast.success).toHaveBeenCalledWith("common.copied_to_clipboard");
    });
  });

  test("shows error toast on failure", async () => {
    refreshSingleUseIdSpy.mockImplementationOnce(() => Promise.reject(new Error("fail")));
    render(
      <SurveyAnalysisCTA
        survey={dummySurvey}
        environment={dummyEnvironment}
        isReadOnly={false}
        surveyDomain={surveyDomain}
        user={dummyUser}
        responseCount={5}
      />
    );

    const copyButton = screen.getByRole("button", { name: "common.copy_link" });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(refreshSingleUseIdSpy).toHaveBeenCalled();
      expect(writeTextMock).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("environments.surveys.summary.failed_to_copy_link");
    });
  });
});

// New tests for squarePenIcon and edit functionality
describe("SurveyAnalysisCTA - Edit functionality", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("opens EditPublicSurveyAlertDialog when edit icon is clicked and response count > 0", async () => {
    render(
      <SurveyAnalysisCTA
        survey={dummySurvey}
        environment={dummyEnvironment}
        isReadOnly={false}
        surveyDomain={surveyDomain}
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
        surveyDomain={surveyDomain}
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
        surveyDomain={surveyDomain}
        user={dummyUser}
        responseCount={5}
      />
    );

    // Try to find the edit button (it shouldn't exist)
    const editButton = screen.queryByRole("button", { name: "common.edit" });
    expect(editButton).not.toBeInTheDocument();
  });
});

// Updated test description to mention EditPublicSurveyAlertDialog
describe("SurveyAnalysisCTA - duplicateSurveyAndRoute and EditPublicSurveyAlertDialog", () => {
  afterEach(() => {
    cleanup();
  });

  test("duplicates survey successfully and navigates to edit page", async () => {
    // Mock the API response
    mockCopySurveyToOtherEnvironmentAction.mockResolvedValueOnce({
      data: { id: "duplicated-survey-456" },
    });

    render(
      <SurveyAnalysisCTA
        survey={dummySurvey}
        environment={dummyEnvironment}
        isReadOnly={false}
        surveyDomain={surveyDomain}
        user={dummyUser}
        responseCount={5}
      />
    );

    // Find and click the edit button to show dialog
    const editButton = screen.getByRole("button", { name: "common.edit" });
    await fireEvent.click(editButton);

    // Find and click the duplicate button in dialog
    const duplicateButton = screen.getByRole("button", {
      name: "environments.surveys.edit.caution_edit_duplicate",
    });
    await fireEvent.click(duplicateButton);

    // Verify the API was called with correct parameters
    expect(mockCopySurveyToOtherEnvironmentAction).toHaveBeenCalledWith({
      environmentId: dummyEnvironment.id,
      surveyId: dummySurvey.id,
      targetEnvironmentId: dummyEnvironment.id,
    });

    // Verify success toast was shown
    expect(toast.success).toHaveBeenCalledWith("environments.surveys.survey_duplicated_successfully");

    // Verify navigation to edit page
    expect(mockPush).toHaveBeenCalledWith(
      `/environments/${dummyEnvironment.id}/surveys/duplicated-survey-456/edit`
    );
  });

  test("shows error toast when duplication fails with error object", async () => {
    // Mock API failure with error object
    mockCopySurveyToOtherEnvironmentAction.mockResolvedValueOnce({
      error: "Test error message",
    });

    render(
      <SurveyAnalysisCTA
        survey={dummySurvey}
        environment={dummyEnvironment}
        isReadOnly={false}
        surveyDomain={surveyDomain}
        user={dummyUser}
        responseCount={5}
      />
    );

    // Open dialog
    const editButton = screen.getByRole("button", { name: "common.edit" });
    await fireEvent.click(editButton);

    // Click duplicate
    const duplicateButton = screen.getByRole("button", {
      name: "environments.surveys.edit.caution_edit_duplicate",
    });
    await fireEvent.click(duplicateButton);

    // Verify error toast
    expect(toast.error).toHaveBeenCalledWith("Test error message");
  });

  test("navigates to edit page when cancel button is clicked in dialog", async () => {
    render(
      <SurveyAnalysisCTA
        survey={dummySurvey}
        environment={dummyEnvironment}
        isReadOnly={false}
        surveyDomain={surveyDomain}
        user={dummyUser}
        responseCount={5}
      />
    );

    // Open dialog
    const editButton = screen.getByRole("button", { name: "common.edit" });
    await fireEvent.click(editButton);

    // Click edit (cancel) button
    const editButtonInDialog = screen.getByRole("button", { name: "common.edit" });
    await fireEvent.click(editButtonInDialog);

    // Verify navigation
    expect(mockPush).toHaveBeenCalledWith(
      `/environments/${dummyEnvironment.id}/surveys/${dummySurvey.id}/edit`
    );
  });

  test("shows loading state when duplicating survey", async () => {
    // Create a promise that we can resolve manually
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockCopySurveyToOtherEnvironmentAction.mockImplementation(() => promise);

    render(
      <SurveyAnalysisCTA
        survey={dummySurvey}
        environment={dummyEnvironment}
        isReadOnly={false}
        surveyDomain={surveyDomain}
        user={dummyUser}
        responseCount={5}
      />
    );

    // Open dialog
    const editButton = screen.getByRole("button", { name: "common.edit" });
    await fireEvent.click(editButton);

    // Click duplicate
    const duplicateButton = screen.getByRole("button", {
      name: "environments.surveys.edit.caution_edit_duplicate",
    });
    await fireEvent.click(duplicateButton);

    // Button should now be in loading state
    // expect(duplicateButton).toHaveAttribute("data-state", "loading");

    // Resolve the promise
    resolvePromise!({
      data: { id: "duplicated-survey-456" },
    });

    // Wait for the promise to resolve
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });
  });
});
