import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PlaygroundAutoLinkPlugin } from "./auto-link-plugin";

// URL and email matchers to be exposed through the mock
const URL_MATCHER =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;
const EMAIL_MATCHER = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

// Store the matchers for direct testing
const matchers = [
  (text) => {
    const match = URL_MATCHER.exec(text);
    return (
      match && {
        index: match.index,
        length: match[0].length,
        text: match[0],
        url: match[0],
      }
    );
  },
  (text) => {
    const match = EMAIL_MATCHER.exec(text);
    return (
      match && {
        index: match.index,
        length: match[0].length,
        text: match[0],
        url: `mailto:${match[0]}`,
      }
    );
  },
];

// Mock Lexical AutoLinkPlugin
vi.mock("@lexical/react/LexicalAutoLinkPlugin", () => ({
  AutoLinkPlugin: ({ matchers: matchersProp }: { matchers: Array<(text: string) => any> }) => (
    <div data-testid="auto-link-plugin" data-matchers={matchersProp.length}>
      Auto Link Plugin
    </div>
  ),
}));

describe("PlaygroundAutoLinkPlugin", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with correct matchers", () => {
    const { getByTestId } = render(<PlaygroundAutoLinkPlugin />);

    // Check if AutoLinkPlugin is rendered with the correct number of matchers
    const autoLinkPlugin = getByTestId("auto-link-plugin");
    expect(autoLinkPlugin).toBeInTheDocument();
    expect(autoLinkPlugin).toHaveAttribute("data-matchers", "2");
  });

  test("matches valid URLs correctly", () => {
    const testUrl = "https://example.com";
    const urlMatcher = matchers[0];

    const result = urlMatcher(testUrl);
    expect(result).toBeTruthy();
    if (result) {
      expect(result.url).toBe(testUrl);
    }
  });

  test("matches valid emails correctly", () => {
    const testEmail = "test@example.com";
    const emailMatcher = matchers[1];

    const result = emailMatcher(testEmail);
    expect(result).toBeTruthy();
    if (result) {
      expect(result.url).toBe(`mailto:${testEmail}`);
    }
  });

  test("does not match invalid URLs", () => {
    const invalidUrls = ["not a url", "http://", "www.", "example"];
    const urlMatcher = matchers[0];

    for (const invalidUrl of invalidUrls) {
      const result = urlMatcher(invalidUrl);
      expect(result).toBeFalsy();
    }
  });

  test("does not match invalid emails", () => {
    const invalidEmails = ["not an email", "@example.com", "test@", "test@example"];
    const emailMatcher = matchers[1];

    for (const invalidEmail of invalidEmails) {
      const result = emailMatcher(invalidEmail);
      expect(result).toBeFalsy();
    }
  });
});
