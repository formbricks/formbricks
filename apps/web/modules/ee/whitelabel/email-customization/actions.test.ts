import { describe, expect, test } from "vitest";
import { ZUpdateOrganizationEmailLogoUrlAction } from "./lib/schemas";

describe("updateOrganizationEmailLogoUrlAction input", () => {
  test("rejects non-http(s) logo URLs and accepts storage URLs as the logo", () => {
    const orgId = "clh0a1b2c3d4e5f6g7h8i9j0k";
    expect(
      ZUpdateOrganizationEmailLogoUrlAction.safeParse({
        organizationId: orgId,
        logoUrl: "javascript:alert(1)",
      }).success
    ).toBe(false);
    expect(
      ZUpdateOrganizationEmailLogoUrlAction.safeParse({
        organizationId: orgId,
        logoUrl: "data:image/svg+xml;base64,AAAA",
      }).success
    ).toBe(false);
    expect(
      ZUpdateOrganizationEmailLogoUrlAction.safeParse({
        organizationId: orgId,
        logoUrl: "/storage/ws/public/logo.png",
      }).success
    ).toBe(true);
  });
});
