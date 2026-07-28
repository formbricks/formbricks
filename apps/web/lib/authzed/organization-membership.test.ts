import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { getAuthzedClient } from "./client";
import { isAuthzedEnabled } from "./config";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";
import {
  deleteOrganizationRelationships,
  deleteUserOrganizationRelationships,
  reconcileOrganizationMembership,
} from "./organization-membership";

const clientMocks = {
  deleteRelationships: vi.fn(),
  writeRelationships: vi.fn(),
};

vi.mock("@formbricks/database", () => ({
  prisma: {
    membership: {
      findUnique: vi.fn(),
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
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({ role } as never);

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
      expect(prisma.membership.findUnique).toHaveBeenCalledWith({
        select: { role: true },
        where: {
          userId_organizationId: {
            organizationId: ORGANIZATION_ID,
            userId: USER_ID,
          },
        },
      });
    }
  );

  test("projects accepted and pending Membership rows identically by reading only their role", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ role: "member" } as never);

    await reconcileOrganizationMembership(ORGANIZATION_ID, USER_ID);

    expect(prisma.membership.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { role: true },
      })
    );
    expect(clientMocks.writeRelationships).toHaveBeenCalledTimes(1);
  });

  test("deletes every organization role when the source membership no longer exists", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

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
    vi.mocked(prisma.membership.findUnique)
      .mockResolvedValueOnce({ role: "owner" } as never)
      .mockResolvedValueOnce({ role: "manager" } as never)
      .mockResolvedValueOnce({ role: "manager" } as never)
      .mockResolvedValueOnce({ role: "manager" } as never);

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
    vi.mocked(prisma.membership.findUnique)
      .mockResolvedValueOnce({ role: "owner" } as never)
      .mockResolvedValueOnce({ role: "manager" } as never)
      .mockResolvedValueOnce({ role: "owner" } as never)
      .mockResolvedValueOnce({ role: "manager" } as never)
      .mockResolvedValueOnce({ role: "owner" } as never)
      .mockResolvedValueOnce({ role: "manager" } as never);

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

    expect(prisma.membership.findUnique).not.toHaveBeenCalled();
    expect(getAuthzedClient).not.toHaveBeenCalled();
  });

  test("contains operational failures at the projection boundary with sanitized logs", async () => {
    const privateCause = new Error("raw-sdk-message-with-private-token");
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ role: "owner" } as never);
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
