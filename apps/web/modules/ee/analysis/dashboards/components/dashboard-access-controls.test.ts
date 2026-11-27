import { describe, expect, test } from "vitest";
import { matchesViewAsSearch } from "./dashboard-access-controls";

describe("matchesViewAsSearch", () => {
  const anna = ["Anna Svensson", "anna@example.com"];
  const ola = ["Ola Nordmann", "ola@example.com"];

  test("matches a word inside the name or email, ignoring case", () => {
    expect(matchesViewAsSearch("u1", "anna", anna)).toBe(1);
    expect(matchesViewAsSearch("u1", "SVENS", anna)).toBe(1);
    expect(matchesViewAsSearch("u1", "example.com", anna)).toBe(1);
  });

  test("does not match letters that only appear in order", () => {
    expect(matchesViewAsSearch("u2", "Anna", ola)).toBe(0);
  });

  test("needs every typed word, and ignores the id", () => {
    expect(matchesViewAsSearch("u1", "anna nordmann", anna)).toBe(0);
    expect(matchesViewAsSearch("anna-id", "anna", ola)).toBe(0);
  });
});
