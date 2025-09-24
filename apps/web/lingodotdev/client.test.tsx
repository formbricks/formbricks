import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { I18nProvider } from "./client";
// Import the mocked config to get access to the mock functions
import mockedConfig from "./config";

// Mock dependencies
vi.mock("react-i18next");
vi.mock("./config", () => ({
  default: {
    language: "en-US",
    changeLanguage: vi.fn(),
  },
}));
vi.mock("./shared", () => ({
  DEFAULT_LANGUAGE: "en-US",
}));

const mockI18n = vi.mocked(mockedConfig);

const mockI18nextProvider = vi.mocked(I18nextProvider);

// Mock I18nextProvider to render children
mockI18nextProvider.mockImplementation(({ children }) => {
  return <div data-testid="i18next-provider">{children}</div>;
});

describe("I18nProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockI18n.language = "en-US";

    // Re-setup the mock implementation after clearing mocks
    mockI18nextProvider.mockImplementation(({ children }) => {
      return <div data-testid="i18next-provider">{children}</div>;
    });
  });

  afterEach(() => {
    cleanup();
  });

  test("should render children wrapped in I18nextProvider", () => {
    render(
      <I18nProvider language="en-US">
        <div data-testid="child">Test Child</div>
      </I18nProvider>
    );

    expect(screen.getByTestId("i18next-provider")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Test Child")).toBeInTheDocument();
  });

  test("should use DEFAULT_LANGUAGE when no language provided", async () => {
    mockI18n.language = "de-DE";
    render(
      <I18nProvider language="">
        <div>Test</div>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(mockI18n.changeLanguage).toHaveBeenCalledWith("en-US");
    });
    expect(mockI18nextProvider).toHaveBeenCalled();
    const callArgs = mockI18nextProvider.mock.calls[0][0];
    expect(callArgs.i18n).toBe(mockI18n);
  });

  test("should call changeLanguage when language differs from current", () => {
    mockI18n.language = "en-US";

    render(
      <I18nProvider language="de-DE">
        <div>Test</div>
      </I18nProvider>
    );

    expect(mockI18n.changeLanguage).toHaveBeenCalledWith("de-DE");
  });

  test("should call changeLanguage when language prop changes", () => {
    mockI18n.language = "en-US";

    const { rerender } = render(
      <I18nProvider language="en-US">
        <div>Test</div>
      </I18nProvider>
    );

    expect(mockI18n.changeLanguage).not.toHaveBeenCalled();

    rerender(
      <I18nProvider language="fr-FR">
        <div>Test</div>
      </I18nProvider>
    );

    expect(mockI18n.changeLanguage).toHaveBeenCalledWith("fr-FR");
  });

  test("should pass i18n instance to I18nextProvider", () => {
    render(
      <I18nProvider language="en-US">
        <div>Test</div>
      </I18nProvider>
    );

    expect(mockI18nextProvider).toHaveBeenCalled();
    const callArgs = mockI18nextProvider.mock.calls[0][0];
    expect(callArgs.i18n).toBe(mockI18n);
  });
});
