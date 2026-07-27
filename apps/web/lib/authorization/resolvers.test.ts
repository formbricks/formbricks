import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import {
  getApiKeyAuthById,
  getApiKeyOrganizationId,
  getDashboardWorkspaceId,
  getResponseSurveyId,
  getSurveyWorkspaceId,
  getTeamOrganizationId,
} from "./resolvers";

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: { findUnique: vi.fn() },
    dashboard: { findUnique: vi.fn() },
    response: { findUnique: vi.fn() },
    team: { findUnique: vi.fn() },
    apiKey: { findUnique: vi.fn() },
  },
}));

const prismaKnownError = new Prisma.PrismaClientKnownRequestError("boom", {
  code: "P2025",
  clientVersion: "0.0.0",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parent-id resolvers", () => {
  // Distinct ids per assertion avoid React.cache reuse across calls in one test.
  const cases = [
    { fn: getSurveyWorkspaceId, model: prisma.survey.findUnique, row: { workspaceId: "ws1" }, value: "ws1" },
    {
      fn: getDashboardWorkspaceId,
      model: prisma.dashboard.findUnique,
      row: { workspaceId: "ws2" },
      value: "ws2",
    },
    { fn: getResponseSurveyId, model: prisma.response.findUnique, row: { surveyId: "sv1" }, value: "sv1" },
    { fn: getTeamOrganizationId, model: prisma.team.findUnique, row: { organizationId: "o1" }, value: "o1" },
    {
      fn: getApiKeyOrganizationId,
      model: prisma.apiKey.findUnique,
      row: { organizationId: "o2" },
      value: "o2",
    },
  ];

  test.each(cases)(
    "returns the id when found, null when missing, and rethrows Prisma errors as DatabaseError",
    async ({ fn, model, row, value }) => {
      vi.mocked(model).mockResolvedValueOnce(row);
      await expect(fn("found-id")).resolves.toBe(value);

      vi.mocked(model).mockResolvedValueOnce(null);
      await expect(fn("missing-id")).resolves.toBeNull();

      vi.mocked(model).mockRejectedValueOnce(prismaKnownError);
      await expect(fn("error-id")).rejects.toBeInstanceOf(DatabaseError);
    }
  );
});

describe("getApiKeyAuthById", () => {
  test("maps the key's workspace grants and organization access", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValueOnce({
      id: "key1",
      organizationId: "org1",
      organizationAccess: { accessControl: { read: true, write: false } },
      apiKeyWorkspaces: [{ permission: "read", workspaceId: "ws1", workspace: { name: "Growth" } }],
    } as never);

    await expect(getApiKeyAuthById("key1")).resolves.toEqual({
      type: "apiKey",
      apiKeyId: "key1",
      organizationId: "org1",
      organizationAccess: { accessControl: { read: true, write: false } },
      workspacePermissions: [{ permission: "read", workspaceId: "ws1", workspaceName: "Growth" }],
    });
  });

  test("returns null when the key no longer exists", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValueOnce(null);
    await expect(getApiKeyAuthById("gone")).resolves.toBeNull();
  });

  test("rethrows Prisma errors as DatabaseError", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockRejectedValueOnce(prismaKnownError);
    await expect(getApiKeyAuthById("boom")).rejects.toBeInstanceOf(DatabaseError);
  });
});
