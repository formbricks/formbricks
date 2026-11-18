import { describe, expect, test, vi } from "vitest";

const captured = vi.hoisted(() => ({ schema: undefined as undefined | { safeParse: (v: unknown) => { success: boolean } } }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: (schema: typeof captured.schema) => {
      captured.schema ??= schema;
      return { action: (handler: object) => handler };
    },
  },
}));
vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn() }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ withAuditLogging: vi.fn((_a, _b, h) => h) }));
vi.mock("@/modules/ee/whitelabel/email-customization/lib/organization", () => ({
  removeOrganizationEmailLogoUrl: vi.fn(),
  updateOrganizationEmailLogoUrl: vi.fn(),
}));
vi.mock("@/modules/ee/whitelabel/email-customization/lib/permission", () => ({
  checkWhiteLabelPermission: vi.fn(),
}));
vi.mock("@/modules/email", () => ({ sendEmailCustomizationPreviewEmail: vi.fn() }));

describe("updateOrganizationEmailLogoUrlAction input", () => {
  test("rejects non-http(s) logo URLs and accepts storage URLs as the logo", async () => {
    await import("./actions");
    const orgId = "clh0a1b2c3d4e5f6g7h8i9j0k";
    expect(captured.schema?.safeParse({ organizationId: orgId, logoUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(captured.schema?.safeParse({ organizationId: orgId, logoUrl: "data:image/svg+xml;base64,AAAA" }).success).toBe(false);
    expect(captured.schema?.safeParse({ organizationId: orgId, logoUrl: "/storage/ws/public/logo.png" }).success).toBe(true);
  });
});
