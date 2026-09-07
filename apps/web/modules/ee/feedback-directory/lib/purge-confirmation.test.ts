import { describe, expect, test } from "vitest";
import { truncate } from "@/lib/utils/strings";
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

  // ENG-2129 review: the dialog used to render `truncate(name, 30)` in the confirmation label *and*
  // the input placeholder while matching against the full name, so any dataset with a name longer
  // than 30 characters could never be purged — typing exactly what the UI asked for produced a
  // string ending in "..." that this function rejects. The copy now shows the full name there.
  // Pinned here rather than in the component, since UI is covered by Playwright by policy.
  test("rejects the truncated form of a long name, which is why the dialog must show it in full", () => {
    const longName = "Customer support tickets from the EMEA region";
    expect(longName.length).toBeGreaterThan(30);

    expect(hasMatchingDatasetPurgeConfirmation(truncate(longName, 30), longName)).toBe(false);
    expect(hasMatchingDatasetPurgeConfirmation(longName, longName)).toBe(true);
  });
});
