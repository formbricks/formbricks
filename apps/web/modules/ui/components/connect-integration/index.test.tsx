import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSearchParams } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TIntegrationType } from "@formbricks/types/integration";
import { ConnectIntegration } from "./index";
import { getIntegrationDetails } from "./lib/utils";

// Mock modules
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => ({
    get: vi.fn((param) => null),
  })),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
  },
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="mocked-image" />
  ),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-testid="mocked-link">
      {children}
    </a>
  ),
}));

vi.mock("@/modules/ui/components/formbricks-logo", () => ({
  FormbricksLogo: () => <div data-testid="formbricks-logo">FormbricksLogo</div>,
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, disabled, loading }: any) => (
    <button onClick={onClick} disabled={disabled} data-loading={loading} data-testid="connect-button">
      {children}
    </button>
  ),
}));

vi.mock("./lib/utils", () => ({
  getIntegrationDetails: vi.fn((type, t) => {
    const details = {
      googleSheets: {
        text: "Google Sheets Integration Description",
        docsLink: "https://formbricks.com/docs/integrations/google-sheets",
        connectButtonLabel: "Connect with Google Sheets",
        notConfiguredText: "Google Sheet integration is not configured",
      },
      airtable: {
        text: "Airtable Integration Description",
        docsLink: "https://formbricks.com/docs/integrations/airtable",
        connectButtonLabel: "Connect with Airtable",
        notConfiguredText: "Airtable integration is not configured",
      },
      notion: {
        text: "Notion Integration Description",
        docsLink: "https://formbricks.com/docs/integrations/notion",
        connectButtonLabel: "Connect with Notion",
        notConfiguredText: "Notion integration is not configured",
      },
      slack: {
        text: "Slack Integration Description",
        docsLink: "https://formbricks.com/docs/integrations/slack",
        connectButtonLabel: "Connect with Slack",
        notConfiguredText: "Slack integration is not configured",
      },
    };

    return details[type];
  }),
}));

describe("ConnectIntegration", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps = {
    isEnabled: true,
    integrationType: "googleSheets" as TIntegrationType,
    handleAuthorization: vi.fn(),
    integrationLogoSrc: "/test-image-path.svg",
  };

  test("renders integration details correctly", () => {
    render(<ConnectIntegration {...defaultProps} />);

    expect(screen.getByText("Google Sheets Integration Description")).toBeInTheDocument();
    expect(screen.getByText("Connect with Google Sheets")).toBeInTheDocument();
    expect(screen.getByTestId("mocked-image")).toBeInTheDocument();
    expect(screen.getByTestId("mocked-image")).toHaveAttribute("src", "/test-image-path.svg");
  });

  test("button is disabled when integration is not enabled", () => {
    render(<ConnectIntegration {...defaultProps} isEnabled={false} />);

    expect(screen.getByTestId("connect-button")).toBeDisabled();
  });

  test("calls handleAuthorization when connect button is clicked", async () => {
    const mockHandleAuthorization = vi.fn();
    const user = userEvent.setup();

    render(<ConnectIntegration {...defaultProps} handleAuthorization={mockHandleAuthorization} />);

    await user.click(screen.getByTestId("connect-button"));
    expect(mockHandleAuthorization).toHaveBeenCalledTimes(1);
  });
});
