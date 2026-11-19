import { describe, expect, test } from "vitest";
import { isNavigationInFlight, navigatingFromIdAfterSelect } from "./response-navigation";

describe("isNavigationInFlight", () => {
  test("is in flight while the selection is still the response the click left from", () => {
    expect(isNavigationInFlight("r2", "r2")).toBe(true);
  });

  test("ends once the selection moves on", () => {
    expect(isNavigationInFlight("r2", "r3")).toBe(false);
  });

  test("is never in flight without a recorded response", () => {
    expect(isNavigationInFlight(null, "r2")).toBe(false);
    expect(isNavigationInFlight(null, null)).toBe(false);
  });
});

describe("navigatingFromIdAfterSelect", () => {
  test("keeps the recorded response while another response is selected", () => {
    expect(navigatingFromIdAfterSelect("r2", "r3")).toBe("r2");
  });

  // Next from r2 recorded "r2" and selected r3. The selection is then cleared (modal closed, or r3 deleted
  // from the modal) and r2 opened again: Back and Next must be enabled.
  test("clearing the selection ends navigation, so reopening the left response is not in flight", () => {
    const afterClear = navigatingFromIdAfterSelect("r2", null);
    const afterReopen = navigatingFromIdAfterSelect(afterClear, "r2");

    expect(afterClear).toBeNull();
    expect(isNavigationInFlight(afterReopen, "r2")).toBe(false);
  });
});
