import { ResponseCardModal } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseCardModal";
import { SingleResponseCard } from "@/modules/analysis/components/SingleResponseCard";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";

vi.mock("@/modules/analysis/components/SingleResponseCard", () => ({
  SingleResponseCard: vi.fn(() => <div data-testid="single-response-card">SingleResponseCard</div>),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: vi.fn(({ children, onClick, disabled, variant, className }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      className={className}
      data-testid="mock-button">
      {children}
    </button>
  )),
}));

vi.mock("@/modules/ui/components/modal", () => ({
  Modal: vi.fn(({ children, open }) => (open ? <div data-testid="modal">{children}</div> : null)),
}));

const mockResponses = [
  {
    id: "response1",
    createdAt: new Date(),
    updatedAt: new Date(),
    surveyId: "survey1",
    finished: true,
    data: {},
    meta: {
      userAgent: { browser: "Chrome", os: "Mac OS", device: "Desktop" },
      url: "http://localhost:3000",
    },
    notes: [],
    tags: [],
  } as unknown as TResponse,
  {
    id: "response2",
    createdAt: new Date(),
    updatedAt: new Date(),
    surveyId: "survey1",
    finished: true,
    data: {},
    meta: {
      userAgent: { browser: "Firefox", os: "Windows", device: "Desktop" },
      url: "http://localhost:3000/page2",
    },
    notes: [],
    tags: [],
  } as unknown as TResponse,
  {
    id: "response3",
    createdAt: new Date(),
    updatedAt: new Date(),
    surveyId: "survey1",
    finished: false,
    data: {},
    meta: {
      userAgent: { browser: "Safari", os: "iOS", device: "Mobile" },
      url: "http://localhost:3000/page3",
    },
    notes: [],
    tags: [],
  } as unknown as TResponse,
] as unknown as TResponse[];

const mockSurvey = {
  id: "survey1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Survey",
  type: "app",
  environmentId: "env1",
  status: "inProgress",
  questions: [],
  hiddenFields: { enabled: false, fieldIds: [] },
  displayOption: "displayOnce",
  recontactDays: 0,
  autoClose: null,
  closeOnDate: null,
  delay: 0,
  autoComplete: null,
  surveyClosedMessage: null,
  singleUse: null,
  triggers: [],
  languages: [],
  resultShareKey: null,
  displayPercentage: null,
  welcomeCard: { enabled: false, headline: { default: "Welcome!" } } as unknown as TSurvey["welcomeCard"],
  styling: null,
} as unknown as TSurvey;

const mockEnvironment = {
  id: "env1",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "development",
  appSetupCompleted: false,
} as unknown as TEnvironment;

const mockUser = {
  id: "user1",
  name: "Test User",
  email: "test@example.com",
  emailVerified: new Date(),
  imageUrl: "",
  twoFactorEnabled: false,
  identityProvider: "email",
  createdAt: new Date(),
  updatedAt: new Date(),
  role: "project_manager",
  objective: "increase_conversion",
  notificationSettings: { alert: {}, weeklySummary: {}, unsubscribedOrganizationIds: [] },
} as unknown as TUser;

const mockEnvironmentTags: TTag[] = [
  { id: "tag1", createdAt: new Date(), updatedAt: new Date(), name: "Tag 1", environmentId: "env1" },
];

const mockLocale: TUserLocale = "en-US";

const mockSetSelectedResponseId = vi.fn();
const mockUpdateResponse = vi.fn();
const mockDeleteResponses = vi.fn();
const mockSetOpen = vi.fn();

const defaultProps = {
  responses: mockResponses,
  selectedResponseId: mockResponses[0].id,
  setSelectedResponseId: mockSetSelectedResponseId,
  survey: mockSurvey,
  environment: mockEnvironment,
  user: mockUser,
  environmentTags: mockEnvironmentTags,
  updateResponse: mockUpdateResponse,
  deleteResponses: mockDeleteResponses,
  isReadOnly: false,
  open: true,
  setOpen: mockSetOpen,
  locale: mockLocale,
};

describe("ResponseCardModal", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should not render if selectedResponseId is null", () => {
    const { container } = render(<ResponseCardModal {...defaultProps} selectedResponseId={null} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });

  test("should render the modal when a response is selected", () => {
    render(<ResponseCardModal {...defaultProps} />);
    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByTestId("single-response-card")).toBeInTheDocument();
  });

  test("should call setSelectedResponseId with the next response id when next button is clicked", async () => {
    render(<ResponseCardModal {...defaultProps} selectedResponseId={mockResponses[0].id} />);
    const buttons = screen.getAllByTestId("mock-button");
    const nextButton = buttons.find((button) => button.querySelector("svg.lucide-chevron-right"));
    if (nextButton) await userEvent.click(nextButton);
    expect(mockSetSelectedResponseId).toHaveBeenCalledWith(mockResponses[1].id);
  });

  test("should call setSelectedResponseId with the previous response id when back button is clicked", async () => {
    render(<ResponseCardModal {...defaultProps} selectedResponseId={mockResponses[1].id} />);
    const buttons = screen.getAllByTestId("mock-button");
    const backButton = buttons.find((button) => button.querySelector("svg.lucide-chevron-left"));
    if (backButton) await userEvent.click(backButton);
    expect(mockSetSelectedResponseId).toHaveBeenCalledWith(mockResponses[0].id);
  });

  test("should disable back button if current response is the first one", () => {
    render(<ResponseCardModal {...defaultProps} selectedResponseId={mockResponses[0].id} />);
    const buttons = screen.getAllByTestId("mock-button");
    const backButton = buttons.find((button) => button.querySelector("svg.lucide-chevron-left"));
    expect(backButton).toBeDisabled();
  });

  test("should disable next button if current response is the last one", () => {
    render(
      <ResponseCardModal {...defaultProps} selectedResponseId={mockResponses[mockResponses.length - 1].id} />
    );
    const buttons = screen.getAllByTestId("mock-button");
    const nextButton = buttons.find((button) => button.querySelector("svg.lucide-chevron-right"));
    expect(nextButton).toBeDisabled();
  });

  test("should call setSelectedResponseId with null when close button is clicked", async () => {
    render(<ResponseCardModal {...defaultProps} />);
    const buttons = screen.getAllByTestId("mock-button");
    const closeButton = buttons.find((button) => button.querySelector("svg.lucide-x"));
    if (closeButton) await userEvent.click(closeButton);
    expect(mockSetSelectedResponseId).toHaveBeenCalledWith(null);
  });

  test("useEffect should set open to true and currentIndex when selectedResponseId is provided", () => {
    render(<ResponseCardModal {...defaultProps} selectedResponseId={mockResponses[1].id} />);
    expect(mockSetOpen).toHaveBeenCalledWith(true);
    // Current index is internal state, but we can check if the correct response is displayed
    // by checking the props passed to SingleResponseCard
    expect(vi.mocked(SingleResponseCard).mock.calls[0][0].response).toEqual(mockResponses[1]);
  });

  test("useEffect should set open to false when selectedResponseId is null after being open", () => {
    const { rerender } = render(
      <ResponseCardModal {...defaultProps} selectedResponseId={mockResponses[0].id} />
    );
    expect(mockSetOpen).toHaveBeenCalledWith(true);
    rerender(<ResponseCardModal {...defaultProps} selectedResponseId={null} />);
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  test("should render ChevronLeft, ChevronRight, and XIcon", () => {
    render(<ResponseCardModal {...defaultProps} />);
    expect(document.querySelector(".lucide-chevron-left")).toBeInTheDocument();
    expect(document.querySelector(".lucide-chevron-right")).toBeInTheDocument();
    expect(document.querySelector(".lucide-x")).toBeInTheDocument();
  });
});

// Mock Lucide icons for easier querying
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return {
    ...actual,
    ChevronLeft: vi.fn((props) => <svg {...props} className="lucide-chevron-left" />),
    ChevronRight: vi.fn((props) => <svg {...props} className="lucide-chevron-right" />),
    XIcon: vi.fn((props) => <svg {...props} className="lucide-x" />),
  };
});
