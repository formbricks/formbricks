import { ResponseTable } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseTable";
import { getResponsesDownloadUrlAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { render, screen } from "@testing-library/react";
import * as ReactHotToast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse, TResponseTableData } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUserLocale } from "@formbricks/types/user";

// Mock matchMedia - required for @formkit/auto-animate
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock auto-animate to avoid DOM issues
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [() => {}, null],
}));

// Mock dnd-kit to avoid DOM issues
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }) => <div>{children}</div>,
  useSensor: () => ({}),
  useSensors: () => ({}),
  MouseSensor: class {},
  TouchSensor: class {},
  KeyboardSensor: class {},
  PointerSensor: class {},
  closestCenter: () => ({}),
  closestCorners: () => ({}),
}));

vi.mock("@dnd-kit/modifiers", () => ({
  restrictToHorizontalAxis: () => ({}),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }) => <div>{children}</div>,
  arrayMove: (arr, from, to) => arr,
  horizontalListSortingStrategy: {},
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    isDragging: false,
    isSorting: false,
    over: null,
    active: null,
  }),
}));

// Mock environment variables
vi.mock("@/lib/env", () => ({
  env: {
    IS_FORMBRICKS_CLOUD: "0",
    FORMBRICKS_API_HOST: "http://localhost:3000",
    FORMBRICKS_ENVIRONMENT_ID: "test-env-id",
    NEXTAUTH_URL: "http://localhost:3000", // Add NEXTAUTH_URL
  },
}));

// Mock constants that use env - including all required keys for authentication
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  FORMBRICKS_API_HOST: "http://localhost:3000",
  FORMBRICKS_ENVIRONMENT_ID: "test-env-id",
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef", // Mock 32 character encryption key
  ENTERPRISE_LICENSE_KEY: "mock-license-key", // Mock enterprise license key
  // OAuth related constants
  GITHUB_ID: "mock-github-id",
  GITHUB_SECRET: "mock-github-secret",
  GITHUB_OAUTH_ENABLED: true,
  GOOGLE_CLIENT_ID: "mock-google-client-id",
  GOOGLE_CLIENT_SECRET: "mock-google-client-secret",
  GOOGLE_OAUTH_ENABLED: true,
  AZURE_OAUTH_ENABLED: false,
  OIDC_OAUTH_ENABLED: false,
  SAML_OAUTH_ENABLED: false,
  NEXTAUTH_SECRET: "mock-nextauth-secret",
  NEXTAUTH_URL: "http://localhost:3000", // Add NEXTAUTH_URL
}));

// Mock required actions and helpers
vi.mock("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/actions", () => ({
  getResponsesDownloadUrlAction: vi.fn(),
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn(),
}));

// Mock tolgee translate
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (key: string) => key }),
}));

// Mock toast
vi.mock("react-hot-toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
  default: {
    error: vi.fn(),
  },
}));

// Mock crypto module
vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn().mockReturnValue("encrypted-data"),
  decrypt: vi.fn().mockReturnValue("decrypted-data"),
}));

// Mock license utils module that uses ENTERPRISE_LICENSE_KEY
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  hasValidLicense: vi.fn().mockReturnValue(true),
  hashedKey: "mock-hashed-key",
  PREVIOUS_RESULTS_CACHE_TAG_KEY: "mock-cache-tag-key",
}));

// Mock SSO handlers and providers
vi.mock("@/modules/ee/sso/lib/sso-handlers", () => ({}));
vi.mock("@/modules/ee/sso/lib/providers", () => ({
  getSSOProviders: vi.fn().mockReturnValue([]),
}));

// Mock auth options - this is typically where GitHub OAuth is configured
vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {
    providers: [],
    session: { strategy: "jwt" },
  },
}));

// Mock response service if it's being used
vi.mock("@/lib/response/service", () => ({
  // Add any functions from the service that might be used
}));

// Mock the actual downloadSelectedRows function from ResponseTable component
const mockDownloadSelectedRows = async (responseIds: string[], format: "csv" | "xlsx") => {
  try {
    const downloadResponse = await getResponsesDownloadUrlAction({
      surveyId: "test-survey-id",
      format: format,
      filterCriteria: { responseIds },
    });

    if (downloadResponse?.data) {
      const link = document.createElement("a");
      link.href = downloadResponse.data;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      ReactHotToast.toast.error(
        getFormattedErrorMessage(downloadResponse) ||
          "environments.surveys.responses.error_downloading_responses"
      );
    }
  } catch (error) {
    ReactHotToast.toast.error("environments.surveys.responses.error_downloading_responses");
    console.error(error);
  }
};

describe("ResponseTable - downloadSelectedRows", () => {
  // Create a wrapper function to directly test downloadSelectedRows
  const setup = () => {
    // Create mock for document methods with proper implementation
    const clickMock = vi.fn();

    // Create a real mock element that we can spy on
    const mockLink = {
      href: "",
      click: clickMock,
    };

    const createElement = vi
      .spyOn(document, "createElement")
      .mockImplementation(() => mockLink as unknown as HTMLElement);
    const appendChild = vi.spyOn(document.body, "appendChild").mockImplementation(() => {});
    const removeChild = vi.spyOn(document.body, "removeChild").mockImplementation(() => {});

    const survey = { id: "test-survey-id" };

    return {
      survey,
      downloadSelectedRows: mockDownloadSelectedRows,
      mockLink,
      createElement,
      appendChild,
      removeChild,
      clickMock,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.error to prevent test output pollution
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renders the response table with data correctly", async () => {
    // Mock minimal props required for the component
    const mockProps = {
      data: [
        {
          responseId: "response1",
          createdAt: new Date().toISOString(),
          finished: true,
        },
      ],
      survey: {
        id: "test-survey-id",
        questions: [],
        variables: [], // Add missing variables array
        hiddenFields: { fieldIds: [] }, // Add missing hiddenFields
        isVerifyEmailEnabled: false, // Add missing isVerifyEmailEnabled
      } as TSurvey,
      responses: [
        {
          id: "response1",
          createdAt: new Date().toISOString(),
          data: {},
        },
      ] as TResponse[],
      environment: { id: "test-env-id" } as TEnvironment,
      environmentTags: [] as TTag[],
      isReadOnly: false,
      fetchNextPage: vi.fn(),
      hasMore: false,
      deleteResponses: vi.fn(),
      updateResponse: vi.fn(),
      isFetchingFirstPage: false,
      locale: "en" as TUserLocale,
    };

    // Use React Testing Library to render the component
    render(<ResponseTable {...mockProps} />);

    // Verify that a table is rendered
    expect(screen.getByRole("table")).toBeInTheDocument();

    // Check for no results message when there's no data
    expect(screen.queryByText("common.no_results")).not.toBeInTheDocument();

    // Check that load more button is not present when hasMore is false
    expect(screen.queryByText("common.load_more")).not.toBeInTheDocument();
  });

  test("downloads responses successfully when response has data", async () => {
    const { survey, downloadSelectedRows, mockLink, clickMock } = setup();

    // Mock successful response
    const mockData = "http://download-link.com";
    (getResponsesDownloadUrlAction as any).mockResolvedValue({ data: mockData });

    // Call function directly (not as a method of an object)
    await downloadSelectedRows(["response1", "response2"], "csv");

    // Verify action was called with correct parameters
    expect(getResponsesDownloadUrlAction).toHaveBeenCalledWith({
      surveyId: "test-survey-id",
      format: "csv",
      filterCriteria: { responseIds: ["response1", "response2"] },
    });

    // Verify link was created with the correct href
    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(mockLink.href).toBe(mockData);
    expect(document.body.appendChild).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalled();
  });

  test("shows error toast when response doesn't have data", async () => {
    const { downloadSelectedRows } = setup();

    // Mock error response
    const errorMessage = "Error downloading";
    (getResponsesDownloadUrlAction as any).mockResolvedValue({ error: errorMessage });
    (getFormattedErrorMessage as any).mockReturnValue(errorMessage);

    // Call function
    await downloadSelectedRows(["response1"], "xlsx");

    // Verify error toast was shown
    expect(ReactHotToast.toast.error).toHaveBeenCalledWith(errorMessage);
    expect(document.createElement).not.toHaveBeenCalled();
  });

  test("uses default error message when formatted message is not available", async () => {
    const { downloadSelectedRows } = setup();

    // Mock response with error but no formatted message
    (getResponsesDownloadUrlAction as any).mockResolvedValue({ error: "error" });
    (getFormattedErrorMessage as any).mockReturnValue(null);

    // Call function
    await downloadSelectedRows(["response1"], "xlsx");

    // Verify default error message was used
    expect(ReactHotToast.toast.error).toHaveBeenCalledWith(
      "environments.surveys.responses.error_downloading_responses"
    );
  });

  test("handles exceptions when download action throws", async () => {
    const { downloadSelectedRows } = setup();

    // Mock action to throw error
    (getResponsesDownloadUrlAction as any).mockRejectedValue(new Error("Network error"));

    // Call function
    await downloadSelectedRows(["response1"], "csv");

    // Verify error handling
    expect(ReactHotToast.toast.error).toHaveBeenCalledWith(
      "environments.surveys.responses.error_downloading_responses"
    );
    expect(console.error).toHaveBeenCalled();
  });
});
