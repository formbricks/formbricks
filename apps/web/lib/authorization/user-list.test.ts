import { batch, decisionMetric, freshness, readiness } from "./__mocks__/user-list";
import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, expect, test } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { AuthzedError } from "@/lib/authzed/errors";
import { filterAuthorizedUserIds } from "./user-list";

const resource = { id: "survey-1", type: "survey" } as const;
const row = {
  id: "survey-1",
  workspaceId: "workspace-1",
  workspace: { organizationId: "organization-1" },
  ownerId: "owner",
  visibility: "workspace",
  visibilityVersion: 0,
  visibilityProjectedVersion: 0,
};
beforeEach(() => {
  prisma.survey.findUnique.mockResolvedValue(row as never);
  prisma.user.findMany.mockResolvedValue([
    { id: "owner" },
    { id: "member" },
    { id: "billing" },
    { id: "admin" },
  ] as never);
});

test("checks 50 recipients with one SQL actor query and one fully consistent permission batch", async () => {
  const ids = Array.from({ length: 50 }, (_, index) => `user-${index}`);
  prisma.user.findMany.mockResolvedValue(ids.map((id) => ({ id })) as never);
  await expect(filterAuthorizedUserIds(ids, "survey.response_read", resource)).resolves.toEqual(new Set(ids));
  expect(prisma.survey.findUnique).toHaveBeenCalledOnce();
  expect(prisma.user.findMany).toHaveBeenCalledExactlyOnceWith({
    where: { id: { in: ids }, isActive: true },
    select: { id: true },
  });
  expect(batch).toHaveBeenCalledOnce();
  expect(batch.mock.calls[0][0]).toHaveLength(50);
  expect(freshness).toHaveBeenCalledOnce();
});

test("retains workspace permission decisions for billing users and excludes missing/inactive users", async () => {
  batch.mockResolvedValue([true, false]);
  await expect(
    filterAuthorizedUserIds(["member", "billing", "inactive", "missing"], "survey.response_read", resource)
  ).resolves.toEqual(new Set(["member"]));
  expect(batch).toHaveBeenCalledWith([
    {
      permission: "read",
      resource: { objectId: "workspace-1", objectType: "workspace" },
      subject: { objectId: "member", objectType: "user" },
    },
    {
      permission: "read",
      resource: { objectId: "workspace-1", objectType: "workspace" },
      subject: { objectId: "billing", objectType: "user" },
    },
  ]);
});

test.each([false, true])(
  "preserves the owner/administrator policy for a pending restricted survey (ready=%s)",
  async (ready) => {
    readiness.mockResolvedValue(ready);
    prisma.survey.findUnique.mockResolvedValue({
      ...row,
      visibility: "restricted",
      visibilityVersion: 1,
    } as never);
    batch.mockResolvedValue([true, false, true]);
    await expect(
      filterAuthorizedUserIds(["owner", "member", "admin"], "survey.response_read", resource)
    ).resolves.toEqual(new Set(["owner", "admin"]));
    expect(batch.mock.calls[0][0].map((check: { permission: string }) => check.permission)).toEqual([
      "read",
      "administer",
      "administer",
    ]);
  }
);

test("uses versioned survey permissions when the projection is ready and current", async () => {
  readiness.mockResolvedValue(true);
  prisma.survey.findUnique.mockResolvedValue({
    ...row,
    visibilityVersion: 2,
    visibilityProjectedVersion: 2,
  } as never);
  await filterAuthorizedUserIds(["owner"], "survey.response_read", resource);
  expect(batch).toHaveBeenCalledWith([
    {
      permission: "response_read_v2",
      resource: { objectId: "survey-1", objectType: "survey" },
      subject: { objectId: "owner", objectType: "user" },
    },
  ]);
});

test("deduplicates and pages recipients while refreshing source facts and revocation health for each page", async () => {
  const ids = Array.from({ length: 501 }, (_, index) => `user-${index}`);
  prisma.user.findMany.mockResolvedValue(ids.map((id) => ({ id })) as never);
  await expect(filterAuthorizedUserIds([...ids, ids[0]], "survey.response_read", resource)).resolves.toEqual(
    new Set(ids)
  );
  expect(batch.mock.calls.map(([checks]) => checks.length)).toEqual([250, 250, 1]);
  expect(prisma.survey.findUnique).toHaveBeenCalledTimes(3);
  expect(prisma.user.findMany).toHaveBeenCalledTimes(3);
  expect(freshness).toHaveBeenCalledTimes(3);
});

test("returns no recipients for an empty list or a deleted survey", async () => {
  await expect(filterAuthorizedUserIds([], "survey.response_read", resource)).resolves.toEqual(new Set());
  expect(prisma.user.findMany).not.toHaveBeenCalled();
  prisma.survey.findUnique.mockResolvedValue(null);
  await expect(filterAuthorizedUserIds(["owner"], "survey.response_read", resource)).resolves.toEqual(
    new Set()
  );
  expect(batch).not.toHaveBeenCalled();
  expect(decisionMetric).toHaveBeenCalledWith(expect.objectContaining({ outcome: "deny" }));
});

test("fails closed without partial recipients if a later page fails", async () => {
  const ids = Array.from({ length: 251 }, (_, index) => `user-${index}`);
  prisma.user.findMany.mockResolvedValue(ids.map((id) => ({ id })) as never);
  batch.mockResolvedValueOnce(Array(250).fill(true)).mockRejectedValueOnce(new Error("unavailable"));
  await expect(filterAuthorizedUserIds(ids, "survey.response_read", resource)).rejects.toThrow(AuthzedError);
  expect(decisionMetric).toHaveBeenCalledWith(expect.objectContaining({ outcome: "operational_error" }));
});

test("blocks delivery on unhealthy revocations and on source database errors", async () => {
  freshness.mockRejectedValueOnce(new Error("revocation pending"));
  await expect(filterAuthorizedUserIds(["owner"], "survey.response_read", resource)).rejects.toThrow(
    AuthzedError
  );
  expect(batch).not.toHaveBeenCalled();
  prisma.user.findMany.mockRejectedValueOnce(
    new Prisma.PrismaClientKnownRequestError("unavailable", { code: "P1001", clientVersion: "test" })
  );
  await expect(filterAuthorizedUserIds(["owner"], "survey.response_read", resource)).rejects.toThrow(
    AuthzedError
  );
  expect(batch).not.toHaveBeenCalled();
});
