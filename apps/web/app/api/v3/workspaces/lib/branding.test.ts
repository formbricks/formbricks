import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { can } from "@/lib/authorization";
import { buildStylingFromBrandColor } from "@/lib/styling/constants";
import { getWorkspace } from "@/lib/workspace/service";
import { updateWorkspace } from "@/modules/workspaces/settings/lib/workspace";
import { applyBrandColorToStyling, setV3WorkspaceBranding } from "./branding";
import {
  LogoImageError,
  LogoStorageError,
  discardStoredLogo,
  downloadLogoImage,
  storeLogoImage,
} from "./branding-logo";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));
vi.mock("@/app/api/v3/lib/auth", () => ({
  getV3AuthorizationActor: (authentication: { apiKeyId?: string; user?: { id: string } } | null) => {
    if (authentication?.user) return { type: "user", id: authentication.user.id };
    if (authentication?.apiKeyId) return { type: "apiKey", id: authentication.apiKeyId };
    return null;
  },
  requireV3WorkspaceAccess: vi.fn(),
}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/workspace/service", () => ({ getWorkspace: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/workspaces/settings/lib/workspace", () => ({ updateWorkspace: vi.fn() }));
vi.mock("./branding-logo", async () => {
  class LogoImageError extends Error {}
  class LogoStorageError extends Error {
    constructor() {
      super("The logo could not be stored right now.");
    }
  }
  return {
    LogoImageError,
    LogoStorageError,
    downloadLogoImage: vi.fn(),
    storeLogoImage: vi.fn(),
    discardStoredLogo: vi.fn(),
  };
});

const organizationId = "tz4a98xxat96iws9zmbrgj3a";
const workspaceId = "kj4a98xxat96iws9zmbrgj3a";
const requestId = "req_1";
const instance = "/api/mcp";
const owner = { user: { id: "user_owner" }, expires: "2099-01-01" } as never;
const updatedAt = new Date("2026-03-01T00:00:00Z");

const stored = (overrides: Record<string, unknown> = {}) => ({
  id: workspaceId,
  organizationId,
  updatedAt,
  styling: { allowStyleOverwrite: true, pageFont: true, fontFamily: "Inter", roundness: 12 },
  logo: { url: "/storage/ws/public/old.png", bgColor: "#ffffff" },
  ...overrides,
});

const run = (body: unknown, authentication: unknown = owner, auditLog?: Record<string, unknown>) =>
  setV3WorkspaceBranding({
    workspaceId,
    body,
    authentication: authentication as never,
    requestId,
    instance,
    auditLog: auditLog as never,
  });

describe("applyBrandColorToStyling", () => {
  test("replaces the derived colours and leaves every other styling key as stored", () => {
    const next = applyBrandColorToStyling(
      { allowStyleOverwrite: false, pageFont: true, fontFamily: "Inter", roundness: 12 },
      "#ff0000"
    );
    const derived = buildStylingFromBrandColor("#ff0000");

    expect(next).toMatchObject({
      allowStyleOverwrite: false,
      pageFont: true,
      fontFamily: "Inter",
      roundness: 12,
      brandColor: { light: "#ff0000" },
      buttonBgColor: derived.buttonBgColor,
      buttonTextColor: derived.buttonTextColor,
      background: derived.background,
    });
    // Dimensions are not colours: the brand colour must not reset them to the defaults.
    expect(next.buttonBorderRadius).toBeUndefined();
  });

  test("starts from allowStyleOverwrite true when the workspace has no styling yet", () => {
    expect(applyBrandColorToStyling(null, "#00ff00")).toMatchObject({
      allowStyleOverwrite: true,
      brandColor: { light: "#00ff00" },
    });
  });
});

describe("setV3WorkspaceBranding", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({ workspaceId, organizationId });
    vi.mocked(can).mockResolvedValue(true);
    vi.mocked(getWorkspace).mockResolvedValue(stored() as never);
    vi.mocked(updateWorkspace).mockImplementation(
      async (_id, input) =>
        ({
          ...stored(),
          ...input,
          updatedAt: new Date("2026-04-01T00:00:00Z"),
        }) as never
    );
    vi.mocked(downloadLogoImage).mockResolvedValue({
      bytes: new Uint8Array(),
      mime: "image/png",
      extension: "png",
    });
    vi.mocked(storeLogoImage).mockResolvedValue("/storage/ws/public/logo--fid--2.png");
  });

  test("a brand colour alone writes styling only, normalised, and no logo", async () => {
    const auditLog: Record<string, unknown> = {};

    const response = await run({ brandColor: "#F00" }, owner, auditLog);

    expect(response.status).toBe(200);
    const [, input] = vi.mocked(updateWorkspace).mock.calls[0];
    expect(input.styling).toMatchObject({ brandColor: { light: "#ff0000" }, fontFamily: "Inter" });
    expect(input).not.toHaveProperty("logo");
    expect(input).not.toHaveProperty("expectedUpdatedAt");
    expect(downloadLogoImage).not.toHaveBeenCalled();
    expect((await response.json()).data).toMatchObject({ workspaceId, brandColor: "#ff0000" });
    expect(auditLog).toMatchObject({ organizationId, targetId: workspaceId });
  });

  test("a logo URL is downloaded, stored, and replaces the old logo with a version-checked write", async () => {
    const response = await run({ logoUrl: "https://example.com/logo.png", logoBackgroundColor: "#000000" });

    expect(response.status).toBe(200);
    expect(downloadLogoImage).toHaveBeenCalledWith("https://example.com/logo.png");
    expect(storeLogoImage).toHaveBeenCalledWith(workspaceId, expect.objectContaining({ mime: "image/png" }));
    expect(updateWorkspace).toHaveBeenCalledExactlyOnceWith(workspaceId, {
      logo: { url: "/storage/ws/public/logo--fid--2.png", bgColor: "#000000" },
      expectedUpdatedAt: updatedAt,
    });
    expect(discardStoredLogo).not.toHaveBeenCalled();
    expect((await response.json()).data.logoUrl).toBe("/storage/ws/public/logo--fid--2.png");
  });

  test("logoUrl null removes the logo and keeps its background colour", async () => {
    await run({ logoUrl: null });

    expect(updateWorkspace).toHaveBeenCalledExactlyOnceWith(workspaceId, {
      logo: { bgColor: "#ffffff" },
      expectedUpdatedAt: updatedAt,
    });
    expect(downloadLogoImage).not.toHaveBeenCalled();
  });

  test("a rejected logo is a 422 naming logoUrl, and nothing is stored or written", async () => {
    vi.mocked(downloadLogoImage).mockRejectedValue(new LogoImageError("The logo is larger than 1 MB."));

    const response = await run({ logoUrl: "https://example.com/huge.png" });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.invalid_params).toEqual([{ name: "logoUrl", reason: "The logo is larger than 1 MB." }]);
    expect(storeLogoImage).not.toHaveBeenCalled();
    expect(updateWorkspace).not.toHaveBeenCalled();
  });

  test("a storage failure is 503 and writes nothing", async () => {
    vi.mocked(storeLogoImage).mockRejectedValue(new LogoStorageError());

    expect((await run({ logoUrl: "https://example.com/logo.png" })).status).toBe(503);
    expect(updateWorkspace).not.toHaveBeenCalled();
  });

  test("a stored logo that cannot be attached is discarded, whatever the failure", async () => {
    vi.mocked(updateWorkspace).mockRejectedValueOnce(new OperationNotAllowedError("changed elsewhere"));
    expect((await run({ logoUrl: "https://example.com/logo.png" })).status).toBe(409);
    expect(discardStoredLogo).toHaveBeenCalledWith(workspaceId, "/storage/ws/public/logo--fid--2.png");

    vi.mocked(discardStoredLogo).mockClear();
    vi.mocked(updateWorkspace).mockRejectedValueOnce(new Error("boom"));
    expect((await run({ logoUrl: "https://example.com/logo.png" })).status).toBe(500);
    expect(discardStoredLogo).toHaveBeenCalledOnce();
  });

  test("needs an owner or manager; a plain API key is refused before anything is downloaded", async () => {
    vi.mocked(can).mockResolvedValue(false);
    const key = { apiKeyId: "key_1", organizationId, workspacePermissions: [] };

    expect((await run({ brandColor: "#ff0000" })).status).toBe(403);
    expect((await run({ logoUrl: "https://example.com/logo.png" }, key)).status).toBe(403);
    expect(downloadLogoImage).not.toHaveBeenCalled();
    expect(updateWorkspace).not.toHaveBeenCalled();
  });

  test("validation: empty body, non-https logo, bad colour, unknown key are 400", async () => {
    for (const bad of [
      {},
      { logoUrl: "http://example.com/logo.png" },
      { logoUrl: "https://example.com/" + "a".repeat(2100) },
      { brandColor: "red" },
      { styling: { roundness: 1 } },
    ]) {
      expect((await run(bad)).status).toBe(400);
    }
    expect(updateWorkspace).not.toHaveBeenCalled();
  });
});
