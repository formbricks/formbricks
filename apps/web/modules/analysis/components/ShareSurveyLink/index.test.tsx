import { useSurveyQRCode } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/survey-qr-code";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { copySurveyLink } from "@/modules/survey/lib/client-utils";
import { generateSingleUseIdAction } from "@/modules/survey/list/actions";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ShareSurveyLink } from "./index";

const dummySurvey = {
  id: "survey123",
  singleUse: { enabled: true, isEncrypted: false },
  type: "link",
  status: "completed",
} as any;
const dummyPublicDomain = "http://dummy.com";
const dummyLocale = "en-US";

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  POSTHOG_API_KEY: "mock-posthog-api-key",
  POSTHOG_HOST: "mock-posthog-host",
  IS_POSTHOG_CONFIGURED: true,
  ENCRYPTION_KEY: "mock-encryption-key",
  ENTERPRISE_LICENSE_KEY: "mock-enterprise-license-key",
  GITHUB_ID: "mock-github-id",
  GITHUB_SECRET: "test-githubID",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  AZUREAD_CLIENT_ID: "test-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "test-azure",
  AZUREAD_TENANT_ID: "test-azuread-tenant-id",
  OIDC_DISPLAY_NAME: "test-oidc-display-name",
  OIDC_CLIENT_ID: "test-oidc-client-id",
  OIDC_ISSUER: "test-oidc-issuer",
  OIDC_CLIENT_SECRET: "test-oidc-client-secret",
  OIDC_SIGNING_ALGORITHM: "test-oidc-signing-algorithm",
  WEBAPP_URL: "test-webapp-url",
  IS_PRODUCTION: false,
}));

vi.mock("@/modules/survey/list/actions", () => ({
  generateSingleUseIdAction: vi.fn(),
}));

vi.mock("@/modules/survey/lib/client-utils", () => ({
  copySurveyLink: vi.fn(),
}));

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/survey-qr-code",
  () => ({
    useSurveyQRCode: vi.fn(() => ({
      downloadQRCode: vi.fn(),
    })),
  })
);

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn((error: any) => error.message),
}));

vi.mock("./components/LanguageDropdown", () => {
  const React = require("react");
  return {
    LanguageDropdown: (props: { setLanguage: (lang: string) => void }) => {
      // Call setLanguage("fr-FR") when the component mounts to simulate a language change.
      React.useEffect(() => {
        props.setLanguage("fr-FR");
      }, [props.setLanguage]);
      return <div>Mocked LanguageDropdown</div>;
    },
  };
});

describe("ShareSurveyLink", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    window.open = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  test("calls getUrl on mount and sets surveyUrl accordingly with singleUse enabled and default language", async () => {
    // Inline mocks for this test
    vi.mocked(generateSingleUseIdAction).mockResolvedValue({ data: "dummySuId" });

    const setSurveyUrl = vi.fn();
    render(
      <ShareSurveyLink
        survey={dummySurvey}
        publicDomain={dummyPublicDomain}
        surveyUrl=""
        setSurveyUrl={setSurveyUrl}
        locale={dummyLocale}
      />
    );
    await waitFor(() => {
      expect(setSurveyUrl).toHaveBeenCalled();
    });
    const url = setSurveyUrl.mock.calls[0][0];
    expect(url).toContain(`${dummyPublicDomain}/s/${dummySurvey.id}?suId=dummySuId`);
    expect(url).not.toContain("lang=");
  });

  test("appends language query when language is changed from default", async () => {
    vi.mocked(generateSingleUseIdAction).mockResolvedValue({ data: "dummySuId" });

    const setSurveyUrl = vi.fn();
    const DummyWrapper = () => (
      <ShareSurveyLink
        survey={dummySurvey}
        publicDomain={dummyPublicDomain}
        surveyUrl="initial"
        setSurveyUrl={setSurveyUrl}
        locale="fr-FR"
      />
    );
    render(<DummyWrapper />);
    await waitFor(() => {
      const generatedUrl = setSurveyUrl.mock.calls[1][0];
      expect(generatedUrl).toContain("lang=fr-FR");
    });
  });

  test("preview button opens new window with preview query", async () => {
    vi.mocked(generateSingleUseIdAction).mockResolvedValue({ data: "dummySuId" });

    const setSurveyUrl = vi.fn().mockReturnValue(`${dummyPublicDomain}/s/${dummySurvey.id}?suId=dummySuId`);
    render(
      <ShareSurveyLink
        survey={dummySurvey}
        publicDomain={dummyPublicDomain}
        surveyUrl={`${dummyPublicDomain}/s/${dummySurvey.id}?suId=dummySuId`}
        setSurveyUrl={setSurveyUrl}
        locale={dummyLocale}
      />
    );
    const previewButton = await screen.findByRole("button", {
      name: /environments.surveys.preview_survey_in_a_new_tab/i,
    });
    fireEvent.click(previewButton);
    await waitFor(() => {
      expect(window.open).toHaveBeenCalled();
      const previewUrl = vi.mocked(window.open).mock.calls[0][0];
      expect(previewUrl).toMatch(/\?suId=dummySuId(&|\\?)preview=true/);
    });
  });

  test("copy button writes surveyUrl to clipboard and shows toast", async () => {
    vi.mocked(getFormattedErrorMessage).mockReturnValue("common.copied_to_clipboard");
    vi.mocked(copySurveyLink).mockImplementation((url: string, newId: string) => `${url}?suId=${newId}`);

    const setSurveyUrl = vi.fn();
    const surveyUrl = `${dummyPublicDomain}/s/${dummySurvey.id}?suId=dummySuId`;
    render(
      <ShareSurveyLink
        survey={dummySurvey}
        publicDomain={dummyPublicDomain}
        surveyUrl={surveyUrl}
        setSurveyUrl={setSurveyUrl}
        locale={dummyLocale}
      />
    );
    const copyButton = await screen.findByRole("button", {
      name: /environments.surveys.copy_survey_link_to_clipboard/i,
    });
    fireEvent.click(copyButton);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(surveyUrl);
      expect(toast.success).toHaveBeenCalledWith("common.copied_to_clipboard");
    });
  });

  test("download QR code button calls downloadQRCode", async () => {
    const dummyDownloadQRCode = vi.fn();
    vi.mocked(getFormattedErrorMessage).mockReturnValue("common.copied_to_clipboard");
    vi.mocked(useSurveyQRCode).mockReturnValue({ downloadQRCode: dummyDownloadQRCode } as any);

    const setSurveyUrl = vi.fn();
    render(
      <ShareSurveyLink
        survey={dummySurvey}
        publicDomain={dummyPublicDomain}
        surveyUrl={`${dummyPublicDomain}/s/${dummySurvey.id}?suId=dummySuId`}
        setSurveyUrl={setSurveyUrl}
        locale={dummyLocale}
      />
    );
    const downloadButton = await screen.findByRole("button", {
      name: /environments.surveys.summary.download_qr_code/i,
    });
    fireEvent.click(downloadButton);
    expect(dummyDownloadQRCode).toHaveBeenCalled();
  });

  test("renders regenerate button when survey.singleUse.enabled is true and calls generateNewSingleUseLink", async () => {
    vi.mocked(generateSingleUseIdAction).mockResolvedValue({ data: "dummySuId" });

    const setSurveyUrl = vi.fn();
    render(
      <ShareSurveyLink
        survey={dummySurvey}
        publicDomain={dummyPublicDomain}
        surveyUrl={`${dummyPublicDomain}/s/${dummySurvey.id}?suId=dummySuId`}
        setSurveyUrl={setSurveyUrl}
        locale={dummyLocale}
      />
    );
    const regenButton = await screen.findByRole("button", { name: /Regenerate single use survey link/i });
    fireEvent.click(regenButton);
    await waitFor(() => {
      expect(generateSingleUseIdAction).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("environments.surveys.new_single_use_link_generated");
    });
  });

  test("handles error when generating single-use link fails", async () => {
    vi.mocked(generateSingleUseIdAction).mockResolvedValue({ data: undefined });
    vi.mocked(getFormattedErrorMessage).mockReturnValue("Failed to generate link");

    const setSurveyUrl = vi.fn();
    render(
      <ShareSurveyLink
        survey={dummySurvey}
        publicDomain={dummyPublicDomain}
        surveyUrl=""
        setSurveyUrl={setSurveyUrl}
        locale={dummyLocale}
      />
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to generate link");
    });
  });
});
