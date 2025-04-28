import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { SurveyAnalysisCTA } from "../SurveyAnalysisCTA";

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
  AI_AZURE_LLM_RESSOURCE_NAME: "mock-azure-llm-resource-name",
  AI_AZURE_LLM_API_KEY: "mock-azure-llm-api-key",
  AI_AZURE_LLM_DEPLOYMENT_ID: "mock-azure-llm-deployment-id",
  AI_AZURE_EMBEDDINGS_RESSOURCE_NAME: "mock-azure-embeddings-resource-name",
  AI_AZURE_EMBEDDINGS_API_KEY: "mock-azure-embeddings-api-key",
  AI_AZURE_EMBEDDINGS_DEPLOYMENT_ID: "mock-azure-embeddings-deployment-id",
  IS_PRODUCTION: true,
  FB_LOGO_URL: "https://example.com/mock-logo.png",
  SMTP_HOST: "mock-smtp-host",
  SMTP_PORT: "mock-smtp-port",
  IS_POSTHOG_CONFIGURED: true,
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => mockSearchParams, // Reuse the same object
  usePathname: () => "/current",
}));

// Mock copySurveyLink to return a predictable string
vi.mock("@/modules/survey/lib/client-utils", () => ({
  copySurveyLink: vi.fn((url: string, id: string) => `${url}?id=${id}`),
}));

vi.spyOn(toast, "success");
vi.spyOn(toast, "error");

// Set up a fake clipboard
const writeTextMock = vi.fn(() => Promise.resolve());
Object.assign(navigator, {
  clipboard: { writeText: writeTextMock },
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
