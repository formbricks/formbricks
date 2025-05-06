import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { ResultsShareButton } from "./ResultsShareButton";

// Mock actions
const mockDeleteResultShareUrlAction = vi.fn();
const mockGenerateResultShareUrlAction = vi.fn();
const mockGetResultShareUrlAction = vi.fn();

vi.mock("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/actions", () => ({
  deleteResultShareUrlAction: (...args) => mockDeleteResultShareUrlAction(...args),
  generateResultShareUrlAction: (...args) => mockGenerateResultShareUrlAction(...args),
  getResultShareUrlAction: (...args) => mockGetResultShareUrlAction(...args),
}));

// Mock helper
const mockGetFormattedErrorMessage = vi.fn((error) => error?.message || "An error occurred");
vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: (error) => mockGetFormattedErrorMessage(error),
}));

// Mock UI components
vi.mock("@/modules/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuContent: ({ children, align }) => (
    <div data-testid="dropdown-menu-content" data-align={align}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({ children, onClick, icon }) => (
    <button data-testid="dropdown-menu-item" onClick={onClick}>
      {icon}
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children }) => <div data-testid="dropdown-menu-trigger">{children}</div>,
}));

// Mock Tolgee
const mockT = vi.fn((key) => key);
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: mockT }),
}));

// Mock icons
vi.mock("lucide-react", () => ({
  CopyIcon: () => <div data-testid="copy-icon" />,
  DownloadIcon: () => <div data-testid="download-icon" />,
  GlobeIcon: () => <div data-testid="globe-icon" />,
  LinkIcon: () => <div data-testid="link-icon" />,
}));

// Mock toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("react-hot-toast", () => ({
  default: {
    success: (...args) => mockToastSuccess(...args),
    error: (...args) => mockToastError(...args),
  },
}));

// Mock ShareSurveyResults component
const mockShareSurveyResults = vi.fn();
vi.mock("../(analysis)/summary/components/ShareSurveyResults", () => ({
  ShareSurveyResults: (props) => {
    mockShareSurveyResults(props);
    return props.open ? (
      <div data-testid="share-survey-results-modal">
        <span>ShareSurveyResults Modal</span>
        <button onClick={() => props.setOpen(false)}>Close Modal</button>
        <button data-testid="handle-publish-button" onClick={props.handlePublish}>
          Publish
        </button>
        <button data-testid="handle-unpublish-button" onClick={props.handleUnpublish}>
          Unpublish
        </button>
      </div>
    ) : null;
  },
}));

const mockSurvey = {
  id: "survey1",
  name: "Test Survey",
  type: "app",
  status: "inProgress",
  questions: [],
  hiddenFields: { enabled: false },
  displayOption: "displayOnce",
  recontactDays: 0,
  autoClose: null,
  delay: 0,
  autoComplete: null,
  surveyClosedMessage: null,
  singleUse: null,
  resultShareKey: null,
  languages: [],
  triggers: [],
  welcomeCard: { enabled: false } as TSurvey["welcomeCard"],
  styling: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  environmentId: "env1",
  variables: [],
  closeOnDate: null,
} as unknown as TSurvey;

const webAppUrl = "https://app.formbricks.com";
const originalLocation = window.location;

describe("ResultsShareButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location.href
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, href: "https://app.formbricks.com/surveys/survey1" },
    });
    // Mock navigator.clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  test("renders initial state and fetches sharing key (no existing key)", async () => {
    mockGetResultShareUrlAction.mockResolvedValue({ data: null });
    render(<ResultsShareButton survey={mockSurvey} webAppUrl={webAppUrl} />);

    expect(screen.getByTestId("dropdown-menu-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("link-icon")).toBeInTheDocument();
    expect(mockGetResultShareUrlAction).toHaveBeenCalledWith({ surveyId: mockSurvey.id });
    await waitFor(() => {
      expect(screen.queryByTestId("share-survey-results-modal")).not.toBeInTheDocument();
    });
  });

  test("handles copy private link to clipboard", async () => {
    mockGetResultShareUrlAction.mockResolvedValue({ data: null });
    render(<ResultsShareButton survey={mockSurvey} webAppUrl={webAppUrl} />);

    fireEvent.click(screen.getByTestId("dropdown-menu-trigger")); // Open dropdown
    const copyLinkButton = (await screen.findAllByTestId("dropdown-menu-item")).find((item) =>
      item.textContent?.includes("common.copy_link")
    );
    expect(copyLinkButton).toBeInTheDocument();
    await userEvent.click(copyLinkButton!);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.href);
    expect(mockToastSuccess).toHaveBeenCalledWith("common.copied_to_clipboard");
  });

  test("handles copy public link to clipboard", async () => {
    const shareKey = "publicShareKey";
    mockGetResultShareUrlAction.mockResolvedValue({ data: shareKey });
    render(<ResultsShareButton survey={{ ...mockSurvey, resultShareKey: shareKey }} webAppUrl={webAppUrl} />);

    fireEvent.click(screen.getByTestId("dropdown-menu-trigger")); // Open dropdown
    const copyPublicLinkButton = (await screen.findAllByTestId("dropdown-menu-item")).find((item) =>
      item.textContent?.includes("environments.surveys.summary.copy_link_to_public_results")
    );
    expect(copyPublicLinkButton).toBeInTheDocument();
    await userEvent.click(copyPublicLinkButton!);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${webAppUrl}/share/${shareKey}`);
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "environments.surveys.summary.link_to_public_results_copied"
    );
  });

  test("handles publish to web successfully", async () => {
    mockGetResultShareUrlAction.mockResolvedValue({ data: null });
    mockGenerateResultShareUrlAction.mockResolvedValue({ data: "newShareKey" });
    render(<ResultsShareButton survey={mockSurvey} webAppUrl={webAppUrl} />);

    fireEvent.click(screen.getByTestId("dropdown-menu-trigger"));
    const publishButton = (await screen.findAllByTestId("dropdown-menu-item")).find((item) =>
      item.textContent?.includes("environments.surveys.summary.publish_to_web")
    );
    await userEvent.click(publishButton!);

    expect(screen.getByTestId("share-survey-results-modal")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("handle-publish-button"));

    expect(mockGenerateResultShareUrlAction).toHaveBeenCalledWith({ surveyId: mockSurvey.id });
    await waitFor(() => {
      expect(mockShareSurveyResults).toHaveBeenCalledWith(
        expect.objectContaining({
          surveyUrl: `${webAppUrl}/share/newShareKey`,
          showPublishModal: true,
        })
      );
    });
  });

  test("handles unpublish from web successfully", async () => {
    const shareKey = "toUnpublishKey";
    mockGetResultShareUrlAction.mockResolvedValue({ data: shareKey });
    mockDeleteResultShareUrlAction.mockResolvedValue({ data: { id: mockSurvey.id } });
    render(<ResultsShareButton survey={{ ...mockSurvey, resultShareKey: shareKey }} webAppUrl={webAppUrl} />);

    fireEvent.click(screen.getByTestId("dropdown-menu-trigger"));
    const unpublishButton = (await screen.findAllByTestId("dropdown-menu-item")).find((item) =>
      item.textContent?.includes("environments.surveys.summary.unpublish_from_web")
    );
    await userEvent.click(unpublishButton!);

    expect(screen.getByTestId("share-survey-results-modal")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("handle-unpublish-button"));

    expect(mockDeleteResultShareUrlAction).toHaveBeenCalledWith({ surveyId: mockSurvey.id });
    expect(mockToastSuccess).toHaveBeenCalledWith("environments.surveys.results_unpublished_successfully");
    await waitFor(() => {
      expect(mockShareSurveyResults).toHaveBeenCalledWith(
        expect.objectContaining({
          showPublishModal: false,
        })
      );
    });
  });

  test("opens and closes ShareSurveyResults modal", async () => {
    mockGetResultShareUrlAction.mockResolvedValue({ data: null });
    render(<ResultsShareButton survey={mockSurvey} webAppUrl={webAppUrl} />);

    fireEvent.click(screen.getByTestId("dropdown-menu-trigger"));
    const publishButton = (await screen.findAllByTestId("dropdown-menu-item")).find((item) =>
      item.textContent?.includes("environments.surveys.summary.publish_to_web")
    );
    await userEvent.click(publishButton!);

    expect(screen.getByTestId("share-survey-results-modal")).toBeInTheDocument();
    expect(mockShareSurveyResults).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        surveyUrl: "", // Initially empty as no key fetched yet for this flow
        showPublishModal: false, // Initially false
      })
    );

    await userEvent.click(screen.getByText("Close Modal"));
    expect(screen.queryByTestId("share-survey-results-modal")).not.toBeInTheDocument();
  });
});
