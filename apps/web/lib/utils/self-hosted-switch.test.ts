import { describe, expect, test } from "vitest";
import { isSelfHostedSwitchOn } from "./self-hosted-switch";

describe("isSelfHostedSwitchOn", () => {
  test("is on only when a self-hosted instance sets the switch to 1", () => {
    expect(isSelfHostedSwitchOn("1", { isCloud: false })).toBe(true);
    expect(isSelfHostedSwitchOn("0", { isCloud: false })).toBe(false);
    expect(isSelfHostedSwitchOn(undefined, { isCloud: false })).toBe(false);
  });

  test("Formbricks Cloud ignores the switch whatever its environment says", () => {
    expect(isSelfHostedSwitchOn("1", { isCloud: true })).toBe(false);
  });
});
