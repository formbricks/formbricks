import { describe, expect, test } from "vitest";
import { hasMatchingDatasetPurgeConfirmation } from "./purge-confirmation";

describe("hasMatchingDatasetPurgeConfirmation", () => {
  test("matches the exact name", () => {
    expect(hasMatchingDatasetPurgeConfirmation("Support tickets", "Support tickets")).toBe(true);
  });

  // Typing the name proves you know which dataset you are emptying; it is not a spelling test.
  test("ignores case and surrounding whitespace", () => {
    expect(hasMatchingDatasetPurgeConfirmation("  support TICKETS ", "Support tickets")).toBe(true);
  });

  test("rejects a different dataset's name", () => {
    expect(hasMatchingDatasetPurgeConfirmation("Support tickets", "NPS responses")).toBe(false);
  });

  test("rejects a partial name", () => {
    expect(hasMatchingDatasetPurgeConfirmation("Support", "Support tickets")).toBe(false);
  });

  // An empty box must never satisfy the gate, including for a dataset with a blank-ish name — that
  // would turn the confirmation into a single click.
  test("rejects empty input", () => {
    expect(hasMatchingDatasetPurgeConfirmation("", "Support tickets")).toBe(false);
    expect(hasMatchingDatasetPurgeConfirmation("", "")).toBe(false);
    expect(hasMatchingDatasetPurgeConfirmation("   ", "  ")).toBe(false);
  });
});
