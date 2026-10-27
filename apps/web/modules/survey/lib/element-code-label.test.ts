import { describe, expect, test } from "vitest";
import { formatCodedLabel, getChoiceBadgeText, getElementBadgeText } from "./element-code-label";

describe("formatCodedLabel", () => {
  test("reads 'q1 · question text'", () => {
    expect(formatCodedLabel("q1", "How was it?")).toBe("q1 · How was it?");
  });

  test("is the plain text when there is no code", () => {
    expect(formatCodedLabel(undefined, "How was it?")).toBe("How was it?");
    expect(formatCodedLabel("", "How was it?")).toBe("How was it?");
  });
});

describe("getElementBadgeText", () => {
  test("shows the question code, and the question ID for a question that has none yet", () => {
    expect(getElementBadgeText({ id: "clx9k2pq", code: "nps" })).toBe("nps");
    expect(getElementBadgeText({ id: "clx9k2pq" })).toBe("clx9k2pq");
  });
});

describe("getChoiceBadgeText", () => {
  const element = {
    choices: [{ id: "a", code: "1" }, { id: "b" }, { id: "other", code: "98" }],
  };

  test("shows the answer code of the option", () => {
    expect(getChoiceBadgeText(element, "a")).toBe("1");
    expect(getChoiceBadgeText(element, "other")).toBe("98");
  });

  test("falls back to the option ID when the option has no code, or is not found", () => {
    expect(getChoiceBadgeText(element, "b")).toBe("b");
    expect(getChoiceBadgeText(element, "gone")).toBe("gone");
  });

  test("an element without choices shows the id", () => {
    expect(getChoiceBadgeText({}, "x")).toBe("x");
  });
});
