import { TSurvey } from "@/modules/survey/list/types/surveys";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SurveyDropDownMenu } from "./survey-dropdown-menu";

// Mock translation
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (key: string) => key }),
}));

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
}));

// Mock external dependencies
vi.mock("@/modules/survey/lib/client-utils", () => ({
  copySurveyLink: vi.fn((url: string, suId?: string) => (suId ? `${url}?suId=${suId}` : url)),
}));

vi.mock("@/modules/survey/list/actions", () => ({
  copySurveyToOtherEnvironmentAction: vi.fn(() => Promise.resolve({ data: { id: "duplicatedSurveyId" } })),
  getSurveyAction: vi.fn(() =>
    Promise.resolve({ data: { id: "duplicatedSurveyId", name: "Duplicated Survey" } })
  ),
}));

describe("SurveyDropDownMenu", () => {
  afterEach(() => {
    cleanup();
  });

  test("calls copySurveyLink when copy link is clicked", async () => {
    const mockRefresh = vi.fn().mockResolvedValue("fakeSingleUseId");
    const mockDeleteSurvey = vi.fn();
    const mockDuplicateSurvey = vi.fn();

    render(
      <SurveyDropDownMenu
        environmentId="env123"
        survey={{ ...fakeSurvey, status: "completed" }}
        publicDomain="http://survey.test"
        refreshSingleUseId={mockRefresh}
        duplicateSurvey={mockDuplicateSurvey}
        deleteSurvey={mockDeleteSurvey}
        surveyCount={1}
        setIsFetching={vi.fn()}
      />
    );

    // Find the menu wrapper
    const menuWrapper = screen.getByTestId("survey-dropdown-menu");

    // Inside that wrapper, find the actual trigger (div, button, etc.)
    // By default, the trigger is the first clickable child
    const triggerElement = menuWrapper.querySelector("[class*='p-2']") as HTMLElement;
    expect(triggerElement).toBeInTheDocument();

    // Use userEvent to mimic real user interaction
    await userEvent.click(triggerElement);

    // Click copy link
    const copyLinkButton = screen.getByTestId("copy-link");
    fireEvent.click(copyLinkButton);

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  test("shows edit and delete items when not disabled", async () => {
    render(
      <SurveyDropDownMenu
        environmentId="env123"
        survey={fakeSurvey}
        publicDomain="http://survey.test"
        refreshSingleUseId={vi.fn()}
        duplicateSurvey={vi.fn()}
        deleteSurvey={vi.fn()}
        disabled={false}
        isSurveyCreationDeletionDisabled={false}
        surveyCount={1}
        setIsFetching={vi.fn()}
      />
    );

    // Find the menu wrapper
    const menuWrapper = screen.getByTestId("survey-dropdown-menu");

    // Inside that wrapper, find the actual trigger (div, button, etc.)
    // By default, the trigger is the first clickable child
    const triggerElement = menuWrapper.querySelector("[class*='p-2']") as HTMLElement;
    expect(triggerElement).toBeInTheDocument();

    // Use userEvent to mimic real user interaction
    await userEvent.click(triggerElement);

    const editItem = screen.getByText("common.edit");
    const deleteItem = screen.getByText("common.delete");

    expect(editItem).toBeInTheDocument();
    expect(deleteItem).toBeInTheDocument();
  });

  const fakeSurvey = {
    id: "testSurvey",
    name: "Test Survey",
    status: "inProgress",
    type: "link",
    responseCount: 5,
  } as unknown as TSurvey;

  test("handleEditforActiveSurvey opens EditPublicSurveyAlertDialog for active surveys", async () => {
    render(
      <SurveyDropDownMenu
        environmentId="env123"
        survey={fakeSurvey}
        publicDomain="http://survey.test"
        refreshSingleUseId={vi.fn()}
        duplicateSurvey={vi.fn()}
        deleteSurvey={vi.fn()}
        surveyCount={1}
        setIsFetching={vi.fn()}
      />
    );

    const menuWrapper = screen.getByTestId("survey-dropdown-menu");
    const triggerElement = menuWrapper.querySelector("[class*='p-2']") as HTMLElement;
    expect(triggerElement).toBeInTheDocument();
    await userEvent.click(triggerElement);

    const editButton = screen.getByText("common.edit");
    await userEvent.click(editButton);

    expect(screen.getByText("environments.surveys.edit.caution_edit_published_survey")).toBeInTheDocument();
  });

  test("handleEditforActiveSurvey does not open caution dialog for surveys with 0 response count", async () => {
    render(
      <SurveyDropDownMenu
        environmentId="env123"
        survey={{ ...fakeSurvey, responseCount: 0 }}
        publicDomain="http://survey.test"
        refreshSingleUseId={vi.fn()}
        duplicateSurvey={vi.fn()}
        deleteSurvey={vi.fn()}
        surveyCount={1}
        setIsFetching={vi.fn()}
      />
    );

    const menuWrapper = screen.getByTestId("survey-dropdown-menu");
    const triggerElement = menuWrapper.querySelector("[class*='p-2']") as HTMLElement;
    expect(triggerElement).toBeInTheDocument();
    await userEvent.click(triggerElement);

    const editButton = screen.getByText("common.edit");
    await userEvent.click(editButton);

    expect(
      screen.queryByText("environments.surveys.edit.caution_edit_published_survey")
    ).not.toBeInTheDocument();
  });

  test("<DropdownMenuItem> renders and triggers actions correctly", async () => {
    const mockDuplicateSurvey = vi.fn();
    render(
      <SurveyDropDownMenu
        environmentId="env123"
        survey={fakeSurvey}
        publicDomain="http://survey.test"
        refreshSingleUseId={vi.fn()}
        duplicateSurvey={mockDuplicateSurvey}
        deleteSurvey={vi.fn()}
        surveyCount={1}
        setIsFetching={vi.fn()}
      />
    );

    const menuWrapper = screen.getByTestId("survey-dropdown-menu");
    const triggerElement = menuWrapper.querySelector("[class*='p-2']") as HTMLElement;
    expect(triggerElement).toBeInTheDocument();
    await userEvent.click(triggerElement);

    const duplicateButton = screen.getByText("common.duplicate");
    expect(duplicateButton).toBeInTheDocument();
    await userEvent.click(duplicateButton);

    await waitFor(() => {
      expect(mockDuplicateSurvey).toHaveBeenCalled();
    });
  });

  test("<EditPublicSurveyAlertDialog> displays and handles actions correctly", async () => {
    const mockDuplicateSurvey = vi.fn();
    render(
      <SurveyDropDownMenu
        environmentId="env123"
        survey={{ ...fakeSurvey, responseCount: 5 }}
        publicDomain="http://survey.test"
        refreshSingleUseId={vi.fn()}
        duplicateSurvey={mockDuplicateSurvey}
        deleteSurvey={vi.fn()}
        surveyCount={1}
        setIsFetching={vi.fn()}
      />
    );

    const menuWrapper = screen.getByTestId("survey-dropdown-menu");
    const triggerElement = menuWrapper.querySelector("[class*='p-2']") as HTMLElement;
    expect(triggerElement).toBeInTheDocument();
    await userEvent.click(triggerElement);

    const editButton = screen.getByText("common.edit");
    expect(editButton).toBeInTheDocument();
    await userEvent.click(editButton);

    // Test that the dialog is shown
    const dialogTitle = screen.getByText("environments.surveys.edit.caution_edit_published_survey");
    expect(dialogTitle).toBeInTheDocument();

    // Test that the dialog buttons work
    const editButtonInDialog = screen.getByRole("button", { name: "common.edit" });
    expect(editButtonInDialog).toBeInTheDocument();
    await userEvent.click(editButtonInDialog);

    const duplicateButton = screen.getByRole("button", { name: "common.duplicate" });
    expect(duplicateButton).toBeInTheDocument();
    await userEvent.click(duplicateButton);

    await waitFor(() => {
      expect(mockDuplicateSurvey).toHaveBeenCalled();
    });
  });
});
