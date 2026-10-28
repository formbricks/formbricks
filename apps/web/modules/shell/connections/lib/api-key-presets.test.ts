import { describe, expect, test } from "vitest";
import { ZApiKeyCreateInput } from "@/modules/organization/settings/api-keys/types/api-keys";
import { buildApiKeyCreateInput, canSubmitApiKey } from "./api-key-presets";

describe("buildApiKeyCreateInput", () => {
  test.each([
    ["read", "read"],
    ["author", "write"],
    ["full", "manage"],
  ] as const)("the %s preset grants %s on every selected workspace", (preset, permission) => {
    const input = buildApiKeyCreateInput({
      label: "  Digest  ",
      preset,
      workspaceIds: ["ws-1", "ws-2"],
      allowAuditRead: false,
    });

    expect(input.label).toBe("Digest");
    expect(input.workspacePermissions).toEqual([
      { workspaceId: "ws-1", permission },
      { workspaceId: "ws-2", permission },
    ]);
  });

  test("never asks for organization write access", () => {
    expect(
      buildApiKeyCreateInput({ label: "k", preset: "full", workspaceIds: ["ws-1"], allowAuditRead: true })
        .organizationAccess
    ).toEqual({ accessControl: { read: true, write: false } });
  });

  test("produces input the create action accepts, and never repeats a workspace", () => {
    const input = buildApiKeyCreateInput({
      label: "k",
      preset: "read",
      workspaceIds: ["ws-1", "ws-1"],
      allowAuditRead: false,
    });

    expect(input.workspacePermissions).toHaveLength(1);
    expect(ZApiKeyCreateInput.safeParse(input).success).toBe(true);
  });
});

describe("canSubmitApiKey", () => {
  const base = { label: "k", preset: "read", workspaceIds: ["ws-1"], allowAuditRead: false } as const;

  test("needs a name that is not blank", () => {
    expect(canSubmitApiKey(base)).toBe(true);
    expect(canSubmitApiKey({ ...base, label: "   " })).toBe(false);
  });

  test("needs a workspace or the audit read, so a key is never created with no reach", () => {
    expect(canSubmitApiKey({ ...base, workspaceIds: [] })).toBe(false);
    expect(canSubmitApiKey({ ...base, workspaceIds: [], allowAuditRead: true })).toBe(true);
  });
});
