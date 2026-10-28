import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  createContactAttributeKey,
  deleteContactAttributeKey,
  getContactAttributeKeyById,
  getContactAttributeKeys,
  updateContactAttributeKey,
} from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import {
  createV3ContactAttributeKey,
  deleteV3ContactAttributeKey,
  updateV3ContactAttributeKey,
} from "./attribute-key-operations";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn() }));
vi.mock("@/modules/ee/contacts/lib/contact-attribute-keys", () => ({
  createContactAttributeKey: vi.fn(),
  updateContactAttributeKey: vi.fn(),
  deleteContactAttributeKey: vi.fn(),
  getContactAttributeKeyById: vi.fn(),
  getContactAttributeKeys: vi.fn(),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

const workspaceId = "clxx1234567890123456789012";
const organizationId = "clzz1234567890123456789012";
const attributeKeyId = "clak1234567890123456789012";

const key = (overrides: Record<string, unknown> = {}) => ({
  id: attributeKeyId,
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
  updatedAt: new Date("2026-04-21T10:00:00.000Z"),
  isUnique: false,
  key: "plan",
  name: "Plan",
  description: null,
  type: "custom" as const,
  dataType: "string" as const,
  workspaceId,
  ...overrides,
});

const stored = (overrides: Record<string, unknown> = {}) => ({
  id: attributeKeyId,
  workspaceId,
  type: "custom" as const,
  name: "Plan",
  description: null,
  ...overrides,
});

const base = { authentication: null, requestId: "req_1", instance: "/api/v3/contacts/attribute-keys" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getIsContactsEnabled).mockResolvedValue(true);
  vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({ workspaceId, organizationId } as Awaited<
    ReturnType<typeof requireV3WorkspaceAccess>
  >);
});

describe("createV3ContactAttributeKey", () => {
  const body = { workspaceId, key: "plan", dataType: "string" as const };

  test("creates the key as a custom key of the authorized workspace", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue([]);
    vi.mocked(createContactAttributeKey).mockResolvedValue(key());

    const response = await createV3ContactAttributeKey({ ...base, body });

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v3/contacts/attribute-keys/${attributeKeyId}`);
    expect((await response.json()).data).toEqual({
      id: attributeKeyId,
      key: "plan",
      name: "Plan",
      description: null,
      type: "custom",
      dataType: "string",
    });
    expect(createContactAttributeKey).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, key: "plan" })
    );
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      null,
      workspaceId,
      "readWrite",
      "req_1",
      base.instance
    );
  });

  test("is refused by the entitlement before anything is read", async () => {
    vi.mocked(getIsContactsEnabled).mockResolvedValue(false);

    const response = await createV3ContactAttributeKey({ ...base, body });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("The contacts feature is not enabled for this organization.");
    expect(getContactAttributeKeys).not.toHaveBeenCalled();
    expect(createContactAttributeKey).not.toHaveBeenCalled();
  });

  test("answers 409 for a key that exists, including a lost race", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue([key()]);
    expect((await createV3ContactAttributeKey({ ...base, body })).status).toBe(409);
    expect(createContactAttributeKey).not.toHaveBeenCalled();

    vi.mocked(getContactAttributeKeys).mockResolvedValue([]);
    vi.mocked(createContactAttributeKey).mockRejectedValue(
      new InvalidInputError("Attribute key already exists")
    );
    expect((await createV3ContactAttributeKey({ ...base, body })).status).toBe(409);
  });

  test("answers 422 at the workspace's key ceiling", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue(
      Array.from({ length: 150 }, (_, index) => key({ id: `k${index}`, key: `k${index}` }))
    );

    const response = await createV3ContactAttributeKey({ ...base, body });

    expect(response.status).toBe(422);
    expect(createContactAttributeKey).not.toHaveBeenCalled();
  });
});

describe.each([
  [
    "update",
    (auditLog?: never) =>
      updateV3ContactAttributeKey({ ...base, attributeKeyId, body: { name: "New" }, auditLog }),
  ],
  ["delete", (auditLog?: never) => deleteV3ContactAttributeKey({ ...base, attributeKeyId, auditLog })],
] as const)("%s", (name, call) => {
  const service = name === "update" ? updateContactAttributeKey : deleteContactAttributeKey;

  test("an unknown key answers 403 and no access check runs, so ids cannot be probed", async () => {
    vi.mocked(getContactAttributeKeyById).mockResolvedValue(null);

    expect((await call()).status).toBe(403);
    expect(requireV3WorkspaceAccess).not.toHaveBeenCalled();
    expect(service).not.toHaveBeenCalled();
  });

  test("authorizes against the key's own workspace and is gated by the entitlement", async () => {
    vi.mocked(getContactAttributeKeyById).mockResolvedValue(stored());
    vi.mocked(getIsContactsEnabled).mockResolvedValue(false);

    expect((await call()).status).toBe(403);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      null,
      workspaceId,
      "readWrite",
      "req_1",
      base.instance
    );
    expect(service).not.toHaveBeenCalled();
  });

  test("refuses a default key with a 422 that says why", async () => {
    vi.mocked(getContactAttributeKeyById).mockResolvedValue(stored({ type: "default" }));

    const response = await call();

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe("Default attribute keys cannot be changed or deleted");
    expect(service).not.toHaveBeenCalled();
  });
});

describe("the changes themselves", () => {
  test("update renames a custom key", async () => {
    vi.mocked(getContactAttributeKeyById).mockResolvedValue(stored());
    vi.mocked(updateContactAttributeKey).mockResolvedValue(key({ name: "New" }));

    const response = await updateV3ContactAttributeKey({
      ...base,
      attributeKeyId,
      body: { name: "New" },
    });

    expect((await response.json()).data).toMatchObject({ id: attributeKeyId, name: "New" });
    expect(updateContactAttributeKey).toHaveBeenCalledWith(attributeKeyId, {
      name: "New",
      description: undefined,
    });
  });

  test("delete answers the id that no longer resolves", async () => {
    vi.mocked(getContactAttributeKeyById).mockResolvedValue(stored());
    vi.mocked(deleteContactAttributeKey).mockResolvedValue(key());

    const response = await deleteV3ContactAttributeKey({ ...base, attributeKeyId });

    expect((await response.json()).data).toEqual({ id: attributeKeyId });
    expect(deleteContactAttributeKey).toHaveBeenCalledWith(attributeKeyId);
  });
});
