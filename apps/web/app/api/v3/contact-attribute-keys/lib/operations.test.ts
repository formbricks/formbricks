import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { listV3ContactAttributeKeys } from "./operations";

vi.mock("server-only", () => ({}));

vi.mock("@/app/api/v3/lib/auth", () => ({
  requireV3WorkspaceAccess: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/lib/contact-attribute-keys", () => ({
  getContactAttributeKeys: vi.fn(),
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
  authentication: null,
  requestId: "req_1",
  instance: "/api/v3/contact-attribute-keys",
};

describe("listV3ContactAttributeKeys", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
    });
    expect(getContactAttributeKeys).toHaveBeenCalledWith(workspaceId);
  });

  test("returns the auth response and skips fetching when access is denied", async () => {
    const denied = new Response("forbidden", { status: 403 });
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(denied);

    const response = await listV3ContactAttributeKeys(params);

    expect(response).toBe(denied);
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
