import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import {
  deleteContactAttributeKey,
  getContactAttributeKeyById,
  updateContactAttributeKey,
} from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { deleteContactAttributeKeyAction, updateContactAttributeKeyAction } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: { inputSchema: vi.fn().mockReturnThis(), action: vi.fn((fn) => fn) },
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_action, _target, fn) => fn),
}));
vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: { actions: { stateMutation: {} } },
}));
vi.mock("@/modules/ee/contacts/lib/contacts-entitlement", () => ({ ensureContactsEnabled: vi.fn() }));
vi.mock("@/modules/ee/contacts/lib/contact-attribute-keys", () => ({
  createContactAttributeKey: vi.fn(),
  deleteContactAttributeKey: vi.fn(),
  getContactAttributeKeyById: vi.fn(),
  updateContactAttributeKey: vi.fn(),
}));

type TActionArgs = { ctx: object; parsedInput: object };
const run = (action: unknown, parsedInput: object) =>
  (action as (args: TActionArgs) => Promise<unknown>)({
    ctx: { user: { id: "user_1" }, auditLoggingCtx: {} },
    parsedInput,
  });

const existingKey = { id: "key_1", workspaceId: "ws_1", type: "custom", name: "Plan", description: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue("org_1");
  vi.mocked(getContactAttributeKeyById).mockResolvedValue(existingKey as never);
});

// The workspace comes from the page, never from the key: a key's own `workspaceId` is where it was
// created, and is null for a directory's default keys. The key must be in that workspace's directory.
describe.each([
  ["updateContactAttributeKeyAction", updateContactAttributeKeyAction, updateContactAttributeKey],
  ["deleteContactAttributeKeyAction", deleteContactAttributeKeyAction, deleteContactAttributeKey],
] as const)("%s", (_name, action, write) => {
  test("authorizes on the page's workspace and reads the key in its directory", async () => {
    await run(action, { id: "key_1", workspaceId: "ws_1", name: "Plan" });

    expect(assertCan).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "workspace.write", {
      type: "workspace",
      id: "ws_1",
    });
    expect(getContactAttributeKeyById).toHaveBeenCalledWith("key_1", "ws_1");
    expect(write).toHaveBeenCalledWith(
      "key_1",
      "ws_1",
      ...(write === updateContactAttributeKey ? [expect.anything()] : [])
    );
  });

  test("writes nothing for a key outside the workspace's directory", async () => {
    vi.mocked(getContactAttributeKeyById).mockResolvedValue(null);

    await expect(run(action, { id: "key_1", workspaceId: "ws_1" })).rejects.toThrow(ResourceNotFoundError);
    expect(write).not.toHaveBeenCalled();
  });

  test("reads and writes nothing when the caller may not write the workspace", async () => {
    vi.mocked(assertCan).mockRejectedValueOnce(new AuthorizationError("Not authorized"));

    await expect(run(action, { id: "key_1", workspaceId: "ws_1" })).rejects.toThrow(AuthorizationError);
    expect(getContactAttributeKeyById).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
});
