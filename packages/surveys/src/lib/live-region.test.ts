// @vitest-environment happy-dom
import { beforeEach, describe, expect, test } from "vitest";
import { ensureLiveRegion } from "./live-region";

const LIVE_REGION_ID = "formbricks-live-region";

describe("ensureLiveRegion", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("creates an accessible visually hidden status region", () => {
    const liveRegion = ensureLiveRegion();

    expect(liveRegion.id).toBe(LIVE_REGION_ID);
    expect(liveRegion.getAttribute("role")).toBe("status");
    expect(liveRegion.getAttribute("aria-live")).toBe("polite");
    expect(liveRegion.getAttribute("aria-atomic")).toBe("true");
    expect(liveRegion.style.position).toBe("absolute");
    expect(document.body.lastElementChild).toBe(liveRegion);
  });

  test("reuses an existing live region", () => {
    const existingRegion = document.createElement("div");
    existingRegion.id = LIVE_REGION_ID;
    existingRegion.textContent = "Existing announcement";
    document.body.appendChild(existingRegion);

    expect(ensureLiveRegion()).toBe(existingRegion);
    expect(document.querySelectorAll(`#${LIVE_REGION_ID}`)).toHaveLength(1);
    expect(existingRegion.textContent).toBe("Existing announcement");
  });
});
