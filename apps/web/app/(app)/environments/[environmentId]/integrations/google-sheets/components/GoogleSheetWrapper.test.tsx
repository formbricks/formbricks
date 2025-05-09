import { GoogleSheetWrapper } from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/components/GoogleSheetWrapper";
import { authorize } from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/lib/google";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import {
  TIntegrationGoogleSheets,
  TIntegrationGoogleSheetsCredential,
} from "@formbricks/types/integration/google-sheet";
import { TSurvey } from "@formbricks/types/surveys/types";

// Mock child components and functions
vi.mock(
  "@/app/(app)/environments/[environmentId]/integrations/google-sheets/components/ManageIntegration",
  () => ({
    ManageIntegration: vi.fn(({ setOpenAddIntegrationModal }) => (
      <div data-testid="manage-integration">
        <button onClick={() => setOpenAddIntegrationModal(true)}>Open Modal</button>
      </div>
    )),
  })
);

vi.mock("@/modules/ui/components/connect-integration", () => ({
  ConnectIntegration: vi.fn(({ handleAuthorization }) => (
    <div data-testid="connect-integration">
      <button onClick={handleAuthorization}>Connect</button>
    </div>
  )),
}));

vi.mock(
  "@/app/(app)/environments/[environmentId]/integrations/google-sheets/components/AddIntegrationModal",
  () => ({
    AddIntegrationModal: vi.fn(({ open }) =>
      open ? <div data-testid="add-integration-modal">Modal</div> : null
    ),
  })
);

vi.mock("@/app/(app)/environments/[environmentId]/integrations/google-sheets/lib/google", () => ({
  authorize: vi.fn(() => Promise.resolve("http://google.com/auth")),
}));

const mockEnvironment = {
  id: "test-env-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "development",
  appSetupCompleted: false,
} as unknown as TEnvironment;

const mockSurveys: TSurvey[] = [];
const mockWebAppUrl = "http://localhost:3000";
const mockLocale = "en-US";

const mockGoogleSheetIntegration = {
  id: "test-integration-id",
  type: "googleSheets",
  config: {
    key: { access_token: "test-token" } as unknown as TIntegrationGoogleSheetsCredential,
    data: [],
    email: "test@example.com",
  },
} as unknown as TIntegrationGoogleSheets;

describe("GoogleSheetWrapper", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders ConnectIntegration when not connected", () => {
    render(
      <GoogleSheetWrapper
        isEnabled={true}
        environment={mockEnvironment}
        surveys={mockSurveys}
        webAppUrl={mockWebAppUrl}
        locale={mockLocale}
        // No googleSheetIntegration provided initially
      />
    );
    expect(screen.getByTestId("connect-integration")).toBeInTheDocument();
    expect(screen.queryByTestId("manage-integration")).not.toBeInTheDocument();
    expect(screen.queryByTestId("add-integration-modal")).not.toBeInTheDocument();
  });

  test("renders ConnectIntegration when integration exists but has no key", () => {
    const integrationWithoutKey = {
      ...mockGoogleSheetIntegration,
      config: { data: [], email: "test" },
    } as unknown as TIntegrationGoogleSheets;
    render(
      <GoogleSheetWrapper
        isEnabled={true}
        environment={mockEnvironment}
        surveys={mockSurveys}
        googleSheetIntegration={integrationWithoutKey}
        webAppUrl={mockWebAppUrl}
        locale={mockLocale}
      />
    );
    expect(screen.getByTestId("connect-integration")).toBeInTheDocument();
    expect(screen.queryByTestId("manage-integration")).not.toBeInTheDocument();
  });

  test("calls authorize when connect button is clicked", async () => {
    const user = userEvent.setup();
    // Mock window.location.replace
    const originalLocation = window.location;
    // @ts-expect-error
    delete window.location;
    window.location = { ...originalLocation, replace: vi.fn() } as any;

    render(
      <GoogleSheetWrapper
        isEnabled={true}
        environment={mockEnvironment}
        surveys={mockSurveys}
        webAppUrl={mockWebAppUrl}
        locale={mockLocale}
      />
    );

    const connectButton = screen.getByRole("button", { name: "Connect" });
    await user.click(connectButton);

    expect(vi.mocked(authorize)).toHaveBeenCalledWith(mockEnvironment.id, mockWebAppUrl);
    // Need to wait for the promise returned by authorize to resolve
    await vi.waitFor(() => {
      expect(window.location.replace).toHaveBeenCalledWith("http://google.com/auth");
    });

    // Restore window.location
    window.location = originalLocation as any;
  });

  test("renders ManageIntegration and AddIntegrationModal when connected", () => {
    render(
      <GoogleSheetWrapper
        isEnabled={true}
        environment={mockEnvironment}
        surveys={mockSurveys}
        googleSheetIntegration={mockGoogleSheetIntegration}
        webAppUrl={mockWebAppUrl}
        locale={mockLocale}
      />
    );
    expect(screen.getByTestId("manage-integration")).toBeInTheDocument();
    // Modal is rendered but initially hidden
    expect(screen.queryByTestId("add-integration-modal")).not.toBeInTheDocument();
    expect(screen.queryByTestId("connect-integration")).not.toBeInTheDocument();
  });

  test("opens AddIntegrationModal when triggered from ManageIntegration", async () => {
    const user = userEvent.setup();
    render(
      <GoogleSheetWrapper
        isEnabled={true}
        environment={mockEnvironment}
        surveys={mockSurveys}
        googleSheetIntegration={mockGoogleSheetIntegration}
        webAppUrl={mockWebAppUrl}
        locale={mockLocale}
      />
    );

    expect(screen.queryByTestId("add-integration-modal")).not.toBeInTheDocument();
    const openModalButton = screen.getByRole("button", { name: "Open Modal" }); // Button inside mocked ManageIntegration
    await user.click(openModalButton);
    expect(screen.getByTestId("add-integration-modal")).toBeInTheDocument();
  });
});
