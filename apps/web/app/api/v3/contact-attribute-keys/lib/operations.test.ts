import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { listV3ContactAttributeKeys } from "./operations";

vi.mock("server-only", () => ({}));

vi.mock("@/app/api/v3/lib/auth", () => ({
  requireV3WorkspaceAccess: vi.fn(),
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationByWorkspaceId: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/lib/contact-attribute-keys", () => ({
  getContactAttributeKeys: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsContactsEnabled: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

const workspaceId = "clxx1234567890123456789012";

const attributeKey = {
  id: "clak1234567890123456789012",
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
  updatedAt: new Date("2026-04-21T10:00:00.000Z"),
  isUnique: false,
  key: "plan",
  name: "Plan",
  description: "Subscription plan",
  type: "custom",
  dataType: "string",
  workspaceId,
} as unknown as Awaited<ReturnType<typeof getContactAttributeKeys>>[number];

const params = {
  workspaceId,
  limit: 50,
  authentication: null,
  requestId: "req_1",
  instance: "/api/v3/contact-attribute-keys",
};

describe("listV3ContactAttributeKeys", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getOrganizationByWorkspaceId).mockResolvedValue({
      id: "org_1",
    } as Awaited<ReturnType<typeof getOrganizationByWorkspaceId>>);
    vi.mocked(getIsContactsEnabled).mockResolvedValue(true);
  });

  test("returns the public attribute-key shape for an authorized workspace", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({
      workspaceId,
    } as Awaited<ReturnType<typeof requireV3WorkspaceAccess>>);
    vi.mocked(getContactAttributeKeys).mockResolvedValue([attributeKey]);

    const response = await listV3ContactAttributeKeys(params);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [
        {
          id: "clak1234567890123456789012",
          key: "plan",
          name: "Plan",
          description: "Subscription plan",
          type: "custom",
          dataType: "string",
        },
      ],
      meta: { limit: 50, nextCursor: null },
    });
    expect(getContactAttributeKeys).toHaveBeenCalledWith(workspaceId);
  });

  test("paginates with limit + cursor (nextCursor points to the next page)", async () => {
    const second = {
      ...attributeKey,
      id: "clbk1234567890123456789012",
      key: "role",
    } as typeof attributeKey;
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({
      workspaceId,
    } as Awaited<ReturnType<typeof requireV3WorkspaceAccess>>);
    vi.mocked(getContactAttributeKeys).mockResolvedValue([attributeKey, second]);

    const page1 = await listV3ContactAttributeKeys({ ...params, limit: 1 });
    const body1 = await page1.json();
    expect(body1.data).toHaveLength(1);
    expect(body1.data[0].id).toBe("clak1234567890123456789012");
    expect(typeof body1.meta.nextCursor).toBe("string");

    const page2 = await listV3ContactAttributeKeys({
      ...params,
      limit: 1,
      cursor: body1.meta.nextCursor,
    });
    const body2 = await page2.json();
    expect(body2.data).toHaveLength(1);
    expect(body2.data[0].id).toBe("clbk1234567890123456789012");
    expect(body2.meta.nextCursor).toBeNull();
  });

  test("returns 400 on a malformed cursor", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({
      workspaceId,
    } as Awaited<ReturnType<typeof requireV3WorkspaceAccess>>);
    vi.mocked(getContactAttributeKeys).mockResolvedValue([attributeKey]);

    const response = await listV3ContactAttributeKeys({ ...params, cursor: "%%%%" });

    expect(response.status).toBe(400);
  });

  test("returns the auth response and skips fetching when access is denied", async () => {
    const denied = new Response("forbidden", { status: 403 });
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(denied);

    const response = await listV3ContactAttributeKeys(params);

    expect(response).toBe(denied);
    expect(getContactAttributeKeys).not.toHaveBeenCalled();
  });

  test("returns 403 when the contacts feature is not enabled for the organization", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({
      workspaceId,
    } as Awaited<ReturnType<typeof requireV3WorkspaceAccess>>);
    vi.mocked(getIsContactsEnabled).mockResolvedValue(false);

    const response = await listV3ContactAttributeKeys(params);

    expect(response.status).toBe(403);
    expect(getContactAttributeKeys).not.toHaveBeenCalled();
  });

  test("returns 500 when fetching attribute keys fails", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({
      workspaceId,
    } as Awaited<ReturnType<typeof requireV3WorkspaceAccess>>);
    vi.mocked(getContactAttributeKeys).mockRejectedValue(new DatabaseError("boom"));

    const response = await listV3ContactAttributeKeys(params);

    expect(response.status).toBe(500);
  });
});
