import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";
import {
  assertCanWriteCustomHeadScripts,
  canWriteCustomHeadScripts,
  isCustomHeadScriptsChange,
} from "./custom-head-scripts-permission";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/authorization", () => ({
  can: vi.fn(),
}));

const user = { type: "user", id: "user_1" } as const;
const workspaceId = "ws_1";
const script = "<script>analytics()</script>";

describe("isCustomHeadScriptsChange", () => {
  test("treats a survey saved with its stored scripts as unchanged", () => {
    const stored = { customHeadScripts: script, customHeadScriptsMode: "replace" as const };

    expect(isCustomHeadScriptsChange(stored, stored)).toBe(false);
  });

  test("treats empty and missing scripts, and a missing mode and 'add', as the same", () => {
    expect(
      isCustomHeadScriptsChange(
        { customHeadScripts: "", customHeadScriptsMode: "add" },
        { customHeadScripts: null, customHeadScriptsMode: null }
      )
    ).toBe(false);
  });

  test("ignores keys the write leaves undefined, since they are not written", () => {
    expect(
      isCustomHeadScriptsChange({}, { customHeadScripts: script, customHeadScriptsMode: "replace" })
    ).toBe(false);
  });

  test("flags new, edited and cleared scripts", () => {
    expect(isCustomHeadScriptsChange({ customHeadScripts: script }, null)).toBe(true);
    expect(
      isCustomHeadScriptsChange({ customHeadScripts: `${script} ` }, { customHeadScripts: script })
    ).toBe(true);
    expect(isCustomHeadScriptsChange({ customHeadScripts: null }, { customHeadScripts: script })).toBe(true);
  });

  test("flags a mode change, which can switch off the workspace's own scripts", () => {
    expect(
      isCustomHeadScriptsChange({ customHeadScriptsMode: "replace" }, { customHeadScriptsMode: "add" })
    ).toBe(true);
  });
});

describe("canWriteCustomHeadScripts", () => {
  beforeEach(() => {
    vi.mocked(can).mockReset();
  });

  test("allows an unchanged write without an authorization check", async () => {
    await expect(
      canWriteCustomHeadScripts(
        user,
        workspaceId,
        { customHeadScripts: script },
        { customHeadScripts: script }
      )
    ).resolves.toBe(true);

    expect(can).not.toHaveBeenCalled();
  });

  test("asks for workspace.manage on the survey's workspace when the scripts change", async () => {
    vi.mocked(can).mockResolvedValue(true);

    await expect(
      canWriteCustomHeadScripts(user, workspaceId, { customHeadScripts: script }, null)
    ).resolves.toBe(true);

    expect(can).toHaveBeenCalledWith(user, "workspace.manage", { type: "workspace", id: workspaceId });
  });

  test("denies a change when the actor lacks workspace.manage", async () => {
    vi.mocked(can).mockResolvedValue(false);

    await expect(
      canWriteCustomHeadScripts(
        { type: "apiKey", id: "key_1" },
        workspaceId,
        { customHeadScripts: script },
        null
      )
    ).resolves.toBe(false);
  });
});

describe("assertCanWriteCustomHeadScripts", () => {
  beforeEach(() => {
    vi.mocked(can).mockReset();
  });

  test("throws OperationNotAllowedError when the actor lacks workspace.manage", async () => {
    vi.mocked(can).mockResolvedValue(false);

    await expect(
      assertCanWriteCustomHeadScripts(
        user,
        workspaceId,
        { customHeadScripts: script },
        { customHeadScripts: null }
      )
    ).rejects.toThrow(OperationNotAllowedError);
  });

  test("resolves when the actor holds workspace.manage", async () => {
    vi.mocked(can).mockResolvedValue(true);

    await expect(
      assertCanWriteCustomHeadScripts(
        user,
        workspaceId,
        { customHeadScripts: script },
        { customHeadScripts: null }
      )
    ).resolves.toBeUndefined();
  });
});
