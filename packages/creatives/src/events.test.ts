import { describe, expect, test } from "vitest";
import { MAX_COUNTED_PAGE_LENGTH, getCountedPage } from "./events";

describe("getCountedPage", () => {
  test("keeps the host (port included) and the path, and drops the query string and the hash", () => {
    expect(getCountedPage("https://Example.com/pricing?utm_source=x#plans")).toBe("example.com/pricing");
    expect(getCountedPage("http://localhost:3004/")).toBe("localhost:3004/");
    expect(getCountedPage("https://example.com")).toBe("example.com/");
  });

  test("cuts a very long path", () => {
    const page = getCountedPage(`https://example.com/${"a".repeat(1_000)}`);

    expect(page).toHaveLength(MAX_COUNTED_PAGE_LENGTH);
    expect(page?.startsWith("example.com/aaa")).toBe(true);
  });

  test("has no page for an address without a host", () => {
    expect(getCountedPage("about:blank")).toBeNull();
    expect(getCountedPage("not a url")).toBeNull();
  });
});
