import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TLanguage } from "@formbricks/types/project";
import { TSurvey } from "@formbricks/types/surveys/types";
import { SuccessMessage } from "./SuccessMessage";

// Mock Confetti
vi.mock("@/modules/ui/components/confetti", () => ({
  Confetti: vi.fn(() => <div data-testid="confetti-mock" />),
}));

// Mock useSearchParams from next/navigation
vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
  usePathname: vi.fn(() => "/"), // Default mock for usePathname if ever needed by underlying logic
  useRouter: vi.fn(() => ({ push: vi.fn() })), // Default mock for useRouter
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
  },
}));

const mockReplaceState = vi.fn();

describe("SuccessMessage", () => {
  let mockUrlSearchParamsGet: ReturnType<typeof vi.fn>;

  const mockEnvironmentBase = {
    id: "env1",
    createdAt: new Date(),
    updatedAt: new Date(),
    type: "development",
    appSetupCompleted: false,
  } as unknown as TEnvironment;

  const mockSurveyBase = {
    id: "survey1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Test Survey",
    type: "app",
    environmentId: "env1",
    status: "draft",
    questions: [],
    displayOption: "displayOnce",
    recontactDays: null,
    autoClose: null,
    delay: 0,
    autoComplete: null,
    runOnDate: null,
    closeOnDate: null,
    welcomeCard: {
      enabled: false,
      headline: { default: "" },
      html: { default: "" },
    } as unknown as TSurvey["welcomeCard"],
    triggers: [],
    languages: [
      {
        default: true,
        enabled: true,
        language: { id: "lang1", code: "en", alias: null } as unknown as TLanguage,
      },
    ],
    segment: null,
    singleUse: null,
    styling: null,
    surveyClosedMessage: null,
    hiddenFields: { enabled: false, fieldIds: [] },
    variables: [],
    displayPercentage: null,
  } as unknown as TSurvey;

  beforeEach(() => {
    vi.clearAllMocks(); // Clears mock calls, instances, contexts and results
    mockUrlSearchParamsGet = vi.fn();
    vi.mocked(useSearchParams).mockReturnValue({
      get: mockUrlSearchParamsGet,
    } as any);

    Object.defineProperty(window, "location", {
      value: new URL("http://localhost/somepath"),
      writable: true,
    });

    Object.defineProperty(window, "history", {
      value: {
        replaceState: mockReplaceState,
        pushState: vi.fn(),
        go: vi.fn(),
      },
      writable: true,
    });
    mockReplaceState.mockClear(); // Ensure replaceState mock is clean for each test
  });

  afterEach(() => {
    cleanup();
  });

  test("should show 'almost_there' toast and confetti for app survey with widget not setup when success param is present", async () => {
    mockUrlSearchParamsGet.mockImplementation((param) => (param === "success" ? "true" : null));
    const environment: TEnvironment = { ...mockEnvironmentBase, appSetupCompleted: false };
    const survey: TSurvey = { ...mockSurveyBase, type: "app" };

    render(<SuccessMessage environment={environment} survey={survey} />);

    await waitFor(() => {
      expect(screen.getByTestId("confetti-mock")).toBeInTheDocument();
    });

    expect(toast.success).toHaveBeenCalledWith("environments.surveys.summary.almost_there", {
      id: "survey-publish-success-toast",
      icon: "🤏",
      duration: 5000,
      position: "bottom-right",
    });

    expect(mockReplaceState).toHaveBeenCalledWith({}, "", "http://localhost/somepath");
  });

  test("should show 'congrats' toast and confetti for app survey with widget setup when success param is present", async () => {
    mockUrlSearchParamsGet.mockImplementation((param) => (param === "success" ? "true" : null));
    const environment: TEnvironment = { ...mockEnvironmentBase, appSetupCompleted: true };
    const survey: TSurvey = { ...mockSurveyBase, type: "app" };

    render(<SuccessMessage environment={environment} survey={survey} />);

    await waitFor(() => {
      expect(screen.getByTestId("confetti-mock")).toBeInTheDocument();
    });

    expect(toast.success).toHaveBeenCalledWith("environments.surveys.summary.congrats", {
      id: "survey-publish-success-toast",
      icon: "🎉",
      duration: 5000,
      position: "bottom-right",
    });
    expect(mockReplaceState).toHaveBeenCalledWith({}, "", "http://localhost/somepath");
  });

  test("should show 'congrats' toast, confetti, and update URL for link survey when success param is present", async () => {
    mockUrlSearchParamsGet.mockImplementation((param) => (param === "success" ? "true" : null));
    const environment: TEnvironment = { ...mockEnvironmentBase };
    const survey: TSurvey = { ...mockSurveyBase, type: "link" };

    Object.defineProperty(window, "location", {
      value: new URL("http://localhost/somepath?success=true"), // initial URL with success
      writable: true,
    });

    render(<SuccessMessage environment={environment} survey={survey} />);

    await waitFor(() => {
      expect(screen.getByTestId("confetti-mock")).toBeInTheDocument();
    });

    expect(toast.success).toHaveBeenCalledWith("environments.surveys.summary.congrats", {
      id: "survey-publish-success-toast",
      icon: "🎉",
      duration: 5000,
      position: "bottom-right",
    });
    expect(mockReplaceState).toHaveBeenCalledWith({}, "", "http://localhost/somepath?share=true");
  });

  test("should not show confetti or toast if success param is not present", () => {
    mockUrlSearchParamsGet.mockImplementation((param) => null);
    const environment: TEnvironment = { ...mockEnvironmentBase };
    const survey: TSurvey = { ...mockSurveyBase, type: "app" };

    render(<SuccessMessage environment={environment} survey={survey} />);

    expect(screen.queryByTestId("confetti-mock")).not.toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    expect(mockReplaceState).not.toHaveBeenCalled();
  });
});
