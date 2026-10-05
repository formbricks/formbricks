import { beforeEach, describe, expect, test, vi } from "vitest";
import { type TCustomCss } from "@formbricks/types/custom-css";
import { assertCan } from "@/lib/authorization";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getCustomCssPermission } from "@/modules/ee/license-check/lib/utils";
import { assertCustomCssAccess, isCustomCssChange, prepareCustomCssForSave } from "./custom-css-permission";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getCustomCssPermission: vi.fn() }));

const source = ".button-custom{color:red}";
const stored: TCustomCss = {
  light: { source, compiled: "#fbjs .button-custom{color:red !important;}" },
  dark: null,
  processorVersion: 1,
};
const actor = { type: "user", id: "user" } as const;

describe("custom CSS persistence boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue("org");
    vi.mocked(getCustomCssPermission).mockResolvedValue(true);
    vi.mocked(assertCan).mockResolvedValue(undefined);
  });

  test("treats only source changes as writes, ignoring client-supplied compiled output", async () => {
    const forged = { ...stored, light: { source, compiled: "body{display:none}" } };
    expect(isCustomCssChange(undefined, stored)).toBe(false);
    expect(isCustomCssChange(forged, stored)).toBe(false);
    expect(await prepareCustomCssForSave(forged, stored, "ws", "survey")).toBeUndefined();
    expect(getCustomCssPermission).not.toHaveBeenCalled();
  });

  test("requires the target organization's entitlement for changed, added or removed CSS", async () => {
    vi.mocked(getCustomCssPermission).mockResolvedValue(false);
    await expect(prepareCustomCssForSave(stored, null, "target", "survey")).rejects.toThrow("Scale");
    await expect(prepareCustomCssForSave(null, stored, "target", "survey")).rejects.toThrow("Scale");
    expect(getOrganizationIdFromWorkspaceId).toHaveBeenCalledWith("target");
  });

  test("recompiles changed source and outdated saved policies without trusting the client", async () => {
    const changed = {
      ...stored,
      light: {
        source: ".a{background:url(https://evil.example);color:blue}",
        compiled: "body{display:none}",
      },
    };
    expect((await prepareCustomCssForSave(changed, stored, "ws", "survey"))?.light?.compiled).toBe(
      "#fbjs .a{color:blue !important;}"
    );
    const outdated = { ...stored, processorVersion: 99, light: { source, compiled: "body{display:none}" } };
    expect((await prepareCustomCssForSave(outdated, outdated, "ws", "survey"))?.light?.compiled).toBe(
      stored.light?.compiled
    );
  });

  test("requires organization management for workspace CSS rather than team Manage access", async () => {
    await assertCustomCssAccess(actor, "ws", "workspace");
    expect(assertCan).toHaveBeenCalledWith(actor, "organization.manage", { type: "organization", id: "org" });
    await assertCustomCssAccess(actor, "ws", "survey");
    expect(assertCan).toHaveBeenCalledWith(actor, "workspace.write", { type: "workspace", id: "ws" });
  });
});
