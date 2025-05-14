import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SurveyInline } from "./index";
import * as recaptchaModule from "./recaptcha";

// Mock survey loading functionality
vi.mock("@/modules/ui/components/survey/recaptcha", () => ({
  loadRecaptchaScript: vi.fn().mockResolvedValue(undefined),
  executeRecaptcha: vi.fn().mockResolvedValue("mock-recaptcha-token"),
}));

describe("SurveyInline", () => {
  const mockRenderSurvey = vi.fn();

  beforeEach(() => {
    // Mock fetch to prevent actual network requests
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("console.log('Survey script loaded');"),
    } as Response);

    // Setup window.formbricksSurveys
    window.formbricksSurveys = {
      renderSurveyInline: vi.fn(),
      renderSurveyModal: vi.fn(),
      renderSurvey: mockRenderSurvey,
      onFilePick: vi.fn(),
    };

    // Mock script loading functionality
    Object.defineProperty(window, "formbricksSurveys", {
      value: {
        renderSurveyInline: vi.fn(),
        renderSurveyModal: vi.fn(),
        renderSurvey: mockRenderSurvey,
        onFilePick: vi.fn(),
      },
      writable: true,
    });

    // Mock the document.createElement and appendChild methods
    // to avoid actual DOM manipulation in tests
    const originalCreateElement = document.createElement;

    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "script") {
        const mockScript = originalCreateElement.call(document, "script");
        Object.defineProperty(mockScript, "textContent", {
          set: () => {
            /* mock setter */
          },
          get: () => "",
        });
        return mockScript;
      }
      return originalCreateElement.call(document, tagName);
    });

    vi.spyOn(document.head, "appendChild").mockImplementation(() => document.head);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    // @ts-ignore
    delete window.formbricksSurveys;
  });

  test("renders a container with the correct ID", () => {
    const { container } = render(
      <SurveyInline
        survey={{ id: "survey1" } as any}
        styling={{}}
        isBrandingEnabled={true}
        languageCode="en-US"
      />
    );

    const surveyContainer = container.querySelector('[id^="formbricks-survey-container"]');
    expect(surveyContainer).toBeInTheDocument();
    expect(surveyContainer).toHaveClass("h-full");
    expect(surveyContainer).toHaveClass("w-full");
  });

  test("calls renderSurvey with correct props when formbricksSurveys is available", async () => {
    const mockSurvey = { id: "survey1" };

    render(
      <SurveyInline survey={mockSurvey as any} styling={{}} isBrandingEnabled={true} languageCode="en-US" />
    );

    // Verify the mock was called with correct props
    expect(mockRenderSurvey).toHaveBeenCalled();

    const callArgs = mockRenderSurvey.mock.calls[0][0];
    expect(callArgs.survey).toBe(mockSurvey);
    expect(callArgs.mode).toBe("inline");
    expect(callArgs.containerId).toMatch(/formbricks-survey-container/);
  });

  test("doesn't load recaptcha script when isSpamProtectionEnabled is false", async () => {
    const loadRecaptchaScriptMock = vi.mocked(recaptchaModule.loadRecaptchaScript);
    loadRecaptchaScriptMock.mockClear(); // Reset mock call counts

    render(
      <SurveyInline
        survey={{ id: "survey1" } as any}
        isSpamProtectionEnabled={false}
        styling={{}}
        isBrandingEnabled={true}
        languageCode="en-US"
      />
    );

    expect(loadRecaptchaScriptMock).not.toHaveBeenCalled();
  });

  test("handles script loading error gracefully", async () => {
    // Remove formbricksSurveys to test script loading
    // @ts-ignore
    delete window.formbricksSurveys;

    // Mock fetch to reject
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Failed to load script"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <SurveyInline
        survey={{ id: "survey1" } as any}
        styling={{}}
        isBrandingEnabled={true}
        languageCode="en-US"
      />
    );

    // Wait for the error to be logged
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load the surveys package: ", expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  test("provides a getRecaptchaToken function to the survey renderer", async () => {
    const executeRecaptchaMock = vi.mocked(recaptchaModule.executeRecaptcha);
    executeRecaptchaMock.mockClear(); // Reset mock call counts

    render(
      <SurveyInline
        survey={{ id: "survey1" } as any}
        recaptchaSiteKey="test-site-key"
        styling={{}}
        isBrandingEnabled={true}
        languageCode="en-US"
      />
    );

    // Verify the mock was called with the right function
    expect(mockRenderSurvey).toHaveBeenCalled();

    // Get the getRecaptchaToken function from the props
    const callArgs = mockRenderSurvey.mock.calls[0][0];
    expect(callArgs.getRecaptchaToken).toBeDefined();

    // Call the function to verify it works
    await callArgs.getRecaptchaToken();
    expect(executeRecaptchaMock).toHaveBeenCalledWith("test-site-key");
  });
});
