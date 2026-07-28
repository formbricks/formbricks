import { configMocks, envMock, retryMocks, sdkMocks } from "./__mocks__/client-dependencies";
import { status } from "@grpc/grpc-js";
import { beforeEach, describe, expect, test } from "vitest";
import { closeAuthzedClient, getAuthzedClient } from "./client";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";

describe("AuthZed client facade", () => {
  beforeEach(() => {
    closeAuthzedClient();
    sdkMocks.close.mockReset();
    sdkMocks.deadlineInterceptor.mockClear();
    sdkMocks.deleteRelationships.mockReset();
    sdkMocks.diffSchema.mockReset();
    sdkMocks.newClient.mockReset();
    sdkMocks.readSchema.mockReset();
    sdkMocks.writeRelationships.mockReset();
    sdkMocks.writeSchema.mockReset();
    configMocks.isAuthzedEnabled.mockReset();
    retryMocks.execute.mockClear();
    envMock.AUTHZED_CONSISTENCY = undefined;
    envMock.AUTHZED_ENDPOINT = "spicedb:50051";
    envMock.AUTHZED_INSECURE = "true";
    envMock.AUTHZED_SYSTEM_KEY = "formbricks";
    envMock.AUTHZED_TOKEN = "private-token";
    sdkMocks.newClient.mockReturnValue({
      close: sdkMocks.close,
      promises: {
        deleteRelationships: sdkMocks.deleteRelationships,
        diffSchema: sdkMocks.diffSchema,
        readSchema: sdkMocks.readSchema,
        writeRelationships: sdkMocks.writeRelationships,
        writeSchema: sdkMocks.writeSchema,
      },
    });
    configMocks.isAuthzedEnabled.mockReturnValue(true);
  });

  test("does not construct an SDK client until the facade is requested", () => {
    expect(sdkMocks.newClient).not.toHaveBeenCalled();
  });

  test("throws a typed disabled error without constructing the SDK client", () => {
    configMocks.isAuthzedEnabled.mockReturnValue(false);

    expect(() => getAuthzedClient()).toThrow(AuthzedError);
    expect(() => getAuthzedClient()).toThrow(AUTHZED_ERROR_CODES.DISABLED);
    expect(sdkMocks.newClient).not.toHaveBeenCalled();
  });

  test.each([
    [undefined, 0],
    ["false", 0],
    ["0", 0],
    ["true", 2],
    ["1", 2],
  ] as const)("selects the expected SDK security mode for %s", (insecure, expectedSecurity) => {
    envMock.AUTHZED_INSECURE = insecure;

    getAuthzedClient();

    expect(sdkMocks.newClient).toHaveBeenCalledWith(
      envMock.AUTHZED_TOKEN,
      envMock.AUTHZED_ENDPOINT,
      expectedSecurity,
      undefined,
      { interceptors: [{ timeoutMs: 1_000 }] }
    );
    expect(sdkMocks.deadlineInterceptor).toHaveBeenCalledWith(1_000);
  });

  test("uses the consistency default and preserves the configured token only inside the SDK", () => {
    envMock.AUTHZED_TOKEN = " token-with-significant-spacing ";

    const client = getAuthzedClient();

    expect(client.consistency).toBe("minimize_latency");
    expect(client.systemKey).toBe("formbricks");
    expect(sdkMocks.newClient).toHaveBeenCalledWith(
      " token-with-significant-spacing ",
      "spicedb:50051",
      2,
      undefined,
      { interceptors: [{ timeoutMs: 1_000 }] }
    );
    expect(client).not.toHaveProperty("token");
  });

  test("exposes the configured consistency through the Formbricks facade", () => {
    envMock.AUTHZED_CONSISTENCY = "fully_consistent";

    expect(getAuthzedClient().consistency).toBe("fully_consistent");
  });

  test("reuses the facade singleton without retaining public SDK or credential fields", () => {
    const first = getAuthzedClient();
    const second = getAuthzedClient();

    expect(first).toBe(second);
    expect(sdkMocks.newClient).toHaveBeenCalledTimes(1);
    expect(Object.keys(first).sort()).toEqual([
      "consistency",
      "deleteRelationships",
      "diffSchema",
      "readSchema",
      "systemKey",
      "writeRelationships",
      "writeSchema",
    ]);
    expect(first).not.toHaveProperty("token");
    expect(first).not.toHaveProperty("promises");
    expect(first).not.toHaveProperty("close");
  });

  test("closes, resets, and reconstructs the internal client", () => {
    const first = getAuthzedClient();

    closeAuthzedClient();
    const second = getAuthzedClient();

    expect(sdkMocks.close).toHaveBeenCalledTimes(1);
    expect(sdkMocks.newClient).toHaveBeenCalledTimes(2);
    expect(second).not.toBe(first);
  });

  test("returns only the Formbricks schema wrapper through the resilience pipeline", async () => {
    sdkMocks.readSchema.mockResolvedValue({
      readAt: { token: "revision" },
      schemaText: "definition user {}",
    });

    await expect(getAuthzedClient().readSchema()).resolves.toEqual({
      schemaText: "definition user {}",
    });
    expect(sdkMocks.readSchema).toHaveBeenCalledWith({});
    expect(retryMocks.execute).toHaveBeenCalledWith("read_schema", expect.any(Function));
  });

  test("normalizes SpiceDB's uninitialized-schema response to an empty successful schema", async () => {
    sdkMocks.readSchema.mockRejectedValue({ code: status.NOT_FOUND });

    await expect(getAuthzedClient().readSchema()).resolves.toEqual({ schemaText: "" });
    expect(retryMocks.execute).toHaveBeenCalledWith("read_schema", expect.any(Function));
  });

  test("returns only aggregate schema differences without SDK details", async () => {
    sdkMocks.diffSchema.mockResolvedValue({
      diffs: [
        { diff: { definitionAdded: { name: "private_definition" }, oneofKind: "definitionAdded" } },
        { diff: { definitionAdded: { name: "another_private_definition" }, oneofKind: "definitionAdded" } },
        {
          diff: {
            oneofKind: "permissionExprChanged",
            permissionExprChanged: { name: "private_permission" },
          },
        },
        { diff: { oneofKind: undefined } },
      ],
      readAt: { token: "private-revision" },
    });

    await expect(getAuthzedClient().diffSchema("definition user {}")).resolves.toEqual({
      differenceCount: 4,
      differenceKinds: {
        definition_added: 2,
        permission_expr_changed: 1,
        unknown: 1,
      },
    });
    expect(sdkMocks.diffSchema).toHaveBeenCalledWith({
      comparisonSchema: "definition user {}",
      consistency: {
        requirement: { fullyConsistent: true, oneofKind: "fullyConsistent" },
      },
    });
    expect(retryMocks.execute).toHaveBeenCalledWith("diff_schema", expect.any(Function));
  });

  test("writes the supplied schema through an explicitly retried schema operation", async () => {
    sdkMocks.writeSchema.mockResolvedValue({ writtenAt: { token: "private-revision" } });

    await expect(getAuthzedClient().writeSchema("definition user {}")).resolves.toBeUndefined();

    expect(sdkMocks.writeSchema).toHaveBeenCalledWith({ schema: "definition user {}" });
    expect(retryMocks.execute).toHaveBeenCalledWith("write_schema", expect.any(Function));
  });

  test("translates Formbricks relationship updates without exposing SDK responses", async () => {
    sdkMocks.writeRelationships.mockResolvedValue({ writtenAt: { token: "private-revision" } });

    await expect(
      getAuthzedClient().writeRelationships([
        {
          operation: "touch",
          relationship: {
            relation: "owner",
            resource: { objectId: "org-1", objectType: "organization" },
            subject: { objectId: "user-1", objectType: "user" },
          },
        },
        {
          operation: "delete",
          relationship: {
            relation: "manager",
            resource: { objectId: "org-1", objectType: "organization" },
            subject: { objectId: "user-1", objectType: "user", relation: "member" },
          },
        },
      ])
    ).resolves.toBeUndefined();

    expect(sdkMocks.writeRelationships).toHaveBeenCalledWith({
      optionalPreconditions: [],
      updates: [
        {
          operation: 2,
          relationship: {
            optionalCaveat: undefined,
            optionalExpiresAt: undefined,
            relation: "owner",
            resource: { objectId: "org-1", objectType: "organization" },
            subject: {
              object: { objectId: "user-1", objectType: "user" },
              optionalRelation: "",
            },
          },
        },
        {
          operation: 3,
          relationship: {
            optionalCaveat: undefined,
            optionalExpiresAt: undefined,
            relation: "manager",
            resource: { objectId: "org-1", objectType: "organization" },
            subject: {
              object: { objectId: "user-1", objectType: "user" },
              optionalRelation: "member",
            },
          },
        },
      ],
    });
    expect(retryMocks.execute).toHaveBeenCalledWith("write_relationships", expect.any(Function));
  });

  test.each([0, 1_001])(
    "rejects a relationship batch with %i updates before an SDK request",
    async (batchSize) => {
      const updates = Array.from({ length: batchSize }, () => ({
        operation: "touch" as const,
        relationship: {
          relation: "owner",
          resource: { objectId: "org-1", objectType: "organization" },
          subject: { objectId: "user-1", objectType: "user" },
        },
      }));

      await expect(getAuthzedClient().writeRelationships(updates)).rejects.toMatchObject({
        attempts: 0,
        code: AUTHZED_ERROR_CODES.INVALID_REQUEST,
      });
      expect(sdkMocks.writeRelationships).not.toHaveBeenCalled();
    }
  );

  test("requires a narrowed relationship delete filter", async () => {
    await expect(
      getAuthzedClient().deleteRelationships({
        resourceId: "",
        resourceType: "organization",
      })
    ).rejects.toMatchObject({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.INVALID_REQUEST,
    });
    expect(sdkMocks.deleteRelationships).not.toHaveBeenCalled();
  });

  test("translates a resource-scoped bulk delete through the resilience pipeline", async () => {
    sdkMocks.deleteRelationships.mockResolvedValue({ deletedAt: { token: "private-revision" } });

    await expect(
      getAuthzedClient().deleteRelationships({
        resourceId: "org-1",
        resourceType: "organization",
      })
    ).resolves.toBeUndefined();

    expect(sdkMocks.deleteRelationships).toHaveBeenCalledWith({
      optionalAllowPartialDeletions: false,
      optionalLimit: 0,
      optionalPreconditions: [],
      relationshipFilter: {
        optionalRelation: "",
        optionalResourceId: "org-1",
        optionalResourceIdPrefix: "",
        optionalSubjectFilter: undefined,
        resourceType: "organization",
      },
    });
    expect(retryMocks.execute).toHaveBeenCalledWith("delete_relationships", expect.any(Function));
  });

  test("translates a subject-scoped bulk delete without broadening the resource filter", async () => {
    sdkMocks.deleteRelationships.mockResolvedValue({ deletedAt: { token: "private-revision" } });

    await expect(
      getAuthzedClient().deleteRelationships({
        resourceType: "organization",
        subject: { objectId: "user-1", objectType: "user" },
      })
    ).resolves.toBeUndefined();

    expect(sdkMocks.deleteRelationships).toHaveBeenCalledWith({
      optionalAllowPartialDeletions: false,
      optionalLimit: 0,
      optionalPreconditions: [],
      relationshipFilter: {
        optionalRelation: "",
        optionalResourceId: "",
        optionalResourceIdPrefix: "",
        optionalSubjectFilter: {
          optionalRelation: undefined,
          optionalSubjectId: "user-1",
          subjectType: "user",
        },
        resourceType: "organization",
      },
    });
  });
});
