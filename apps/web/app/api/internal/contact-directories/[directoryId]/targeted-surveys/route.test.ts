import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  isContactsEnabled: vi.fn(),
  getTargeted: vi.fn(),
  getOrganizationId: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: mocks.isContactsEnabled }));
vi.mock("@/modules/ee/contacts/directories/lib/directory-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/ee/contacts/directories/lib/directory-service")>();
  return {
    ...actual,
    getContactDirectoryTargetedSurveys: mocks.getTargeted,
    getContactDirectoryOrganizationId: mocks.getOrganizationId,
  };
});
vi.mock("@formbricks/database", () => ({ prisma: {} }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const ORG_ID = "clorg11111111111111111111";
const USER_ID = "cluser1111111111111111111";
const DIRECTORY_ID = "cldir11111111111111111111";

const TARGETED = {
  workspaces: [
    {
      workspaceId: "clws111111111111111111111",
      surveys: [{ id: "s1", name: "Onboarding", status: "inProgress" }],
      totalCount: 1,
    },
  ],
};

const url = `http://localhost/api/internal/contact-directories/${DIRECTORY_ID}/targeted-surveys`;
const get = (query = "") =>
  GET(new NextRequest(`${url}${query}`), { params: Promise.resolve({ directoryId: DIRECTORY_ID }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.isContactsEnabled.mockResolvedValue(true);
  mocks.getOrganizationId.mockResolvedValue(ORG_ID);
  mocks.getTargeted.mockResolvedValue(TARGETED);
});

describe("GET /api/internal/contact-directories/{directoryId}/targeted-surveys", () => {
  test("returns each workspace's targeted surveys to an owner or manager of the directory's organization", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(TARGETED);
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.getTargeted).toHaveBeenCalledWith(ORG_ID, DIRECTORY_ID);
  });

  test("answers a member, an unknown directory and a missing licence with 403, and a stray parameter with 400", async () => {
    mocks.can.mockResolvedValueOnce(false);
    expect((await get()).status).toBe(403);

    mocks.getOrganizationId.mockResolvedValueOnce(null);
    expect((await get()).status).toBe(403);

    mocks.isContactsEnabled.mockResolvedValueOnce(false);
    expect((await get()).status).toBe(403);

    expect((await get("?workspaceId=x")).status).toBe(400);
    expect(mocks.getTargeted).not.toHaveBeenCalled();
  });
});
