import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { OrganizationRole } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { getAuthzedClient } from "./client";
import { isAuthzedEnabled } from "./config";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";
import {
  deleteOrganizationRelationships,
  deleteUserOrganizationRelationships,
  reconcileOrganizationMembership,
  reconcileOrganizationMemberships,
} from "./organization-membership";

const clientMocks = {
  deleteRelationships: vi.fn(),
  writeRelationships: vi.fn(),
};

vi.mock("@formbricks/database", () => ({
  prisma: {
    membership: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("./client", () => ({
  getAuthzedClient: vi.fn(),
}));

vi.mock("./config", () => ({
  isAuthzedEnabled: vi.fn(),
}));

const ORGANIZATION_ID = "organization-private-id";
const USER_ID = "user-private-id";

const membershipRows = (role: OrganizationRole, userId = USER_ID, organizationId = ORGANIZATION_ID) => [
  { organizationId, role, userId },
];

describe("organization membership projection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAuthzedEnabled).mockReturnValue(true);
    vi.mocked(getAuthzedClient).mockReturnValue(
      clientMocks as unknown as ReturnType<typeof getAuthzedClient>
    );
    clientMocks.deleteRelationships.mockResolvedValue(undefined);
    clientMocks.writeRelationships.mockResolvedValue(undefined);
  });

  test.each(["owner", "manager", "member", "billing"] as const)(
    "atomically touches the %s relationship and deletes the other organization roles",
    async (role) => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue(membershipRows(role) as never);

      await expect(reconcileOrganizationMembership(ORGANIZATION_ID, USER_ID)).resolves.toEqual({
        passes: 1,
        status: "projected",
      });

      const updates = clientMocks.writeRelationships.mock.calls[0][0];
      expect(updates).toHaveLength(4);
      expect(updates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            operation: "touch",
            relationship: expect.objectContaining({ relation: role }),
          }),
        ])
      );
      expect(updates.filter((update) => update.operation === "delete")).toHaveLength(3);
      expect(updates.every(({ relationship }) => relationship.resource.objectId === ORGANIZATION_ID)).toBe(
        true
      );
      expect(updates.every(({ relationship }) => relationship.subject.objectId === USER_ID)).toBe(true);
      expect(prisma.membership.findMany).toHaveBeenCalledWith({
        orderBy: [{ organizationId: "asc" }, { userId: "asc" }],
        select: { organizationId: true, role: true, userId: true },
        where: {
          OR: [{ organizationId: ORGANIZATION_ID, userId: USER_ID }],
        },
      });
    }
  );

  test("projects accepted and pending Membership rows identically by reading only their role", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue(membershipRows("member") as never);

    await reconcileOrganizationMembership(ORGANIZATION_ID, USER_ID);

    // Reading only the role is what makes accepted and pending rows project identically.
    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { organizationId: true, role: true, userId: true },
      })
    );
    expect(clientMocks.writeRelationships).toHaveBeenCalledTimes(1);
  });

  test("deletes every organization role when the source membership no longer exists", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([] as never);

    await expect(reconcileOrganizationMembership(ORGANIZATION_ID, USER_ID)).resolves.toEqual({
      passes: 1,
      status: "projected",
    });

    expect(clientMocks.writeRelationships.mock.calls[0][0]).toEqual(
      expect.arrayContaining(
        ["owner", "manager", "member", "billing"].map((relation) =>
          expect.objectContaining({
            operation: "delete",
            relationship: expect.objectContaining({ relation }),
          })
        )
      )
    );
  });

  test("reconciles again when the source role changes during projection", async () => {
    vi.mocked(prisma.membership.findMany)
      .mockResolvedValueOnce(membershipRows("owner") as never)
      .mockResolvedValueOnce(membershipRows("manager") as never)
      .mockResolvedValueOnce(membershipRows("manager") as never)
      .mockResolvedValueOnce(membershipRows("manager") as never);

    await expect(reconcileOrganizationMembership(ORGANIZATION_ID, USER_ID)).resolves.toEqual({
      passes: 2,
      status: "projected",
    });

    expect(clientMocks.writeRelationships).toHaveBeenCalledTimes(2);
    expect(clientMocks.writeRelationships.mock.calls[1][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: "touch",
          relationship: expect.objectContaining({ relation: "manager" }),
        }),
      ])
    );
  });

  test("returns a stable internal failure after three concurrently changing passes", async () => {
    vi.mocked(prisma.membership.findMany)
      .mockResolvedValueOnce(membershipRows("owner") as never)
      .mockResolvedValueOnce(membershipRows("manager") as never)
      .mockResolvedValueOnce(membershipRows("owner") as never)
      .mockResolvedValueOnce(membershipRows("manager") as never)
      .mockResolvedValueOnce(membershipRows("owner") as never)
      .mockResolvedValueOnce(membershipRows("manager") as never);

    await expect(reconcileOrganizationMembership(ORGANIZATION_ID, USER_ID)).resolves.toEqual({
      attempts: 3,
      code: "authzed_projection_unstable",
      retryable: false,
      status: "failed",
    });
    expect(clientMocks.writeRelationships).toHaveBeenCalledTimes(3);
  });

  test("does not read the database or construct a client when AuthZed is disabled", async () => {
    vi.mocked(isAuthzedEnabled).mockReturnValue(false);

    await expect(reconcileOrganizationMembership(ORGANIZATION_ID, USER_ID)).resolves.toEqual({
      status: "disabled",
    });

    expect(prisma.membership.findMany).not.toHaveBeenCalled();
    expect(getAuthzedClient).not.toHaveBeenCalled();
  });

  test("contains operational failures at the projection boundary with sanitized logs", async () => {
    const privateCause = new Error("raw-sdk-message-with-private-token");
    vi.mocked(prisma.membership.findMany).mockResolvedValue(membershipRows("owner") as never);
    clientMocks.writeRelationships.mockRejectedValue(
      new AuthzedError({
        attempts: 3,
        cause: privateCause,
        code: AUTHZED_ERROR_CODES.UNAVAILABLE,
        operation: "write_relationships",
        retryable: true,
      })
    );

    await expect(reconcileOrganizationMembership(ORGANIZATION_ID, USER_ID)).resolves.toEqual({
      attempts: 3,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      retryable: true,
      status: "failed",
    });

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const serializedLog = JSON.stringify(vi.mocked(logger.warn).mock.calls[0]);
    expect(serializedLog).not.toContain(ORGANIZATION_ID);
    expect(serializedLog).not.toContain(USER_ID);
    expect(serializedLog).not.toContain("private-token");
    expect(serializedLog).not.toContain("raw-sdk-message");
    expect(serializedLog).toContain(AUTHZED_ERROR_CODES.UNAVAILABLE);
  });

  describe("batched reconciliation", () => {
    test("reads every named membership in one query and writes one group per target", async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([
        { organizationId: "org-1", role: "owner", userId: "user-1" },
        { organizationId: "org-2", role: "billing", userId: "user-2" },
      ] as never);

      await expect(
        reconcileOrganizationMemberships({
          memberships: [
            { organizationId: "org-1", userId: "user-1" },
            { organizationId: "org-2", userId: "user-2" },
          ],
        })
      ).resolves.toEqual({ passes: 1, status: "projected" });

      // One read and one write for two memberships, rather than two of each.
      expect(prisma.membership.findMany).toHaveBeenCalledTimes(2); // source + verify
      expect(clientMocks.writeRelationships).toHaveBeenCalledTimes(1);
      expect(clientMocks.writeRelationships.mock.calls[0][0]).toHaveLength(8);
    });

    test("deletes every role for a target with no source row while preserving other targets", async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([
        { organizationId: "org-1", role: "manager", userId: "user-1" },
      ] as never);

      await reconcileOrganizationMemberships({
        memberships: [
          { organizationId: "org-1", userId: "user-1" },
          // Observed in SpiceDB but absent from PostgreSQL — the repair path.
          { organizationId: "org-1", userId: "ghost-user" },
        ],
      });

      const updates = clientMocks.writeRelationships.mock.calls[0][0];
      const ghostUpdates = updates.filter(
        ({ relationship }) => relationship.subject.objectId === "ghost-user"
      );
      expect(ghostUpdates).toHaveLength(4);
      expect(ghostUpdates.every(({ operation }) => operation === "delete")).toBe(true);
      expect(
        updates.filter(
          ({ operation, relationship }) => operation === "touch" && relationship.subject.objectId === "user-1"
        )
      ).toHaveLength(1);
    });

    test("deduplicates repeated targets so a membership is written once", async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue(membershipRows("owner") as never);

      await reconcileOrganizationMemberships({
        memberships: [
          { organizationId: ORGANIZATION_ID, userId: USER_ID },
          { organizationId: ORGANIZATION_ID, userId: USER_ID },
        ],
      });

      expect(clientMocks.writeRelationships.mock.calls[0][0]).toHaveLength(4);
    });

    test.each([[undefined], [[]]])(
      "short-circuits an empty target set without constructing a client (%s)",
      async (memberships) => {
        await expect(reconcileOrganizationMemberships({ memberships })).resolves.toEqual({
          passes: 0,
          status: "projected",
        });

        // `writeRelationships` rejects an empty batch, so reaching the client at all would fail.
        expect(getAuthzedClient).not.toHaveBeenCalled();
        expect(prisma.membership.findMany).not.toHaveBeenCalled();
      }
    );

    test("splits a target set that exceeds the write batch limit without splitting a role group", async () => {
      const memberships = Array.from({ length: 251 }, (_unused, index) => ({
        organizationId: ORGANIZATION_ID,
        userId: `user-${index}`,
      }));
      vi.mocked(prisma.membership.findMany).mockResolvedValue([] as never);

      await expect(reconcileOrganizationMemberships({ memberships })).resolves.toEqual({
        passes: 1,
        status: "projected",
      });

      // 251 targets * 4 relations = 1004 updates, so it must split, and the four updates for a single
      // membership must stay in one request or the role would not change atomically.
      expect(clientMocks.writeRelationships).toHaveBeenCalledTimes(2);
      expect(clientMocks.writeRelationships.mock.calls[0][0]).toHaveLength(1_000);
      expect(clientMocks.writeRelationships.mock.calls[1][0]).toHaveLength(4);
    });
  });

  test("deletes all organization-resource relationships after an organization cascade", async () => {
    await expect(deleteOrganizationRelationships(ORGANIZATION_ID)).resolves.toEqual({
      passes: 1,
      status: "projected",
    });

    expect(clientMocks.deleteRelationships).toHaveBeenCalledWith({
      resourceId: ORGANIZATION_ID,
      resourceType: "organization",
    });
  });

  test("deletes only organization relationships for a deleted user subject", async () => {
    await expect(deleteUserOrganizationRelationships(USER_ID)).resolves.toEqual({
      passes: 1,
      status: "projected",
    });

    expect(clientMocks.deleteRelationships).toHaveBeenCalledWith({
      resourceType: "organization",
      subject: {
        objectId: USER_ID,
        objectType: "user",
      },
    });
  });
});
