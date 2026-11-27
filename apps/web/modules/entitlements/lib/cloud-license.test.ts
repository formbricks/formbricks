import { describe, expect, test } from "vitest";
import { LICENSE_REFUSAL_STATUSES } from "@/modules/ee/license-check/lib/license-status";
import type { TLicenseStatus } from "@/modules/ee/license-check/types/enterprise-license";
import { isCloudLicenseUsable } from "./cloud-license";

describe("isCloudLicenseUsable", () => {
  test.each([true, false])("active and no-license are usable (licenseActive %s)", (licenseActive) => {
    expect(isCloudLicenseUsable({ licenseActive, licenseStatus: "active" })).toBe(true);
    expect(isCloudLicenseUsable({ licenseActive, licenseStatus: "no-license" })).toBe(true);
  });

  // ENG-7563: no answer keeps the last verified license only while it is still in grace.
  test.each([
    { licenseActive: true, expected: true },
    { licenseActive: false, expected: false },
  ])("unreachable with licenseActive $licenseActive → $expected", ({ licenseActive, expected }) => {
    expect(isCloudLicenseUsable({ licenseActive, licenseStatus: "unreachable" })).toBe(expected);
  });

  // Driven by the shared list, so a refusal added there is refused here without another edit.
  test.each(LICENSE_REFUSAL_STATUSES)("refuses %s even while the license is in grace", (licenseStatus) => {
    expect(isCloudLicenseUsable({ licenseActive: true, licenseStatus })).toBe(false);
  });

  test("fails closed on a status it does not know", () => {
    const licenseStatus = "degraded" as unknown as TLicenseStatus;
    expect(isCloudLicenseUsable({ licenseActive: true, licenseStatus })).toBe(false);
  });
});
