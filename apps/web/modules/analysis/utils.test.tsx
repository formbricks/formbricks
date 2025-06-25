import { cleanup } from "@testing-library/react";
import { isValidElement } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { renderHyperlinkedContent } from "./utils";

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn(),
}));

vi.mock("@/modules/survey/list/actions", () => ({
  generateSingleUseIdAction: vi.fn(),
}));

describe("renderHyperlinkedContent", () => {
  afterEach(() => {
    cleanup();
  });

  test("returns a single span element when input has no url", () => {
    const input = "Hello world";
    const elements = renderHyperlinkedContent(input);
    expect(elements).toHaveLength(1);
    const element = elements[0];
    expect(isValidElement(element)).toBe(true);
    // element.type should be "span"
    expect(element.type).toBe("span");
    expect(element.props.children).toEqual("Hello world");
  });

  test("splits input with a valid url into span, anchor, span", () => {
    const input = "Visit https://example.com for info";
    const elements = renderHyperlinkedContent(input);
    // Expect three elements: before text, URL link, after text.
    expect(elements).toHaveLength(3);
    // First element should be span with "Visit "
    expect(elements[0].type).toBe("span");
    expect(elements[0].props.children).toEqual("Visit ");
    // Second element should be an anchor with the URL.
    expect(elements[1].type).toBe("a");
    expect(elements[1].props.href).toEqual("https://example.com");
    expect(elements[1].props.className).toContain("text-blue-500");
    // Third element: span with " for info"
    expect(elements[2].type).toBe("span");
    expect(elements[2].props.children).toEqual(" for info");
  });

  test("handles multiple valid urls in the input", () => {
    const input = "Link1: https://example.com and Link2: https://vitejs.dev";
    const elements = renderHyperlinkedContent(input);
    // Expected parts: "Link1: ", "https://example.com", " and Link2: ", "https://vitejs.dev", ""
    expect(elements).toHaveLength(5);
    expect(elements[1].type).toBe("a");
    expect(elements[1].props.href).toEqual("https://example.com");
    expect(elements[3].type).toBe("a");
    expect(elements[3].props.href).toEqual("https://vitejs.dev");
  });

  test("renders a span instead of anchor when URL constructor throws", () => {
    // Force global.URL to throw for this test.
    const originalURL = global.URL;
    vi.spyOn(global, "URL").mockImplementation(() => {
      throw new Error("Invalid URL");
    });
    const input = "Visit https://broken-url.com now";
    const elements = renderHyperlinkedContent(input);
    // Expect the URL not to be rendered as anchor because isValidUrl returns false
    // The split will still occur, but the element corresponding to the URL should be a span.
    expect(elements).toHaveLength(3);
    // Check the element that would have been an anchor is now a span.
    expect(elements[1].type).toBe("span");
    expect(elements[1].props.children).toEqual("https://broken-url.com");
    // Restore original URL
    global.URL = originalURL;
  });
});
