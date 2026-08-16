import { configMocks, envMock, retryMocks, sdkMocks } from "./__mocks__/client-dependencies";
import { v1 } from "@authzed/authzed-node";
import { status } from "@grpc/grpc-js";
import { beforeEach, describe, expect, test } from "vitest";
import { closeAuthzedClient, configureAuthzedClientForBulkWork, getAuthzedClient } from "./client";
import { AUTHZED_MAX_RESOURCE_LOOKUP_RESULTS, AUTHZED_RESOURCE_LOOKUP_PAGE_SIZE } from "./constants";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";

describe("AuthZed client facade", () => {
  beforeEach(() => {
    closeAuthzedClient();
    sdkMocks.close.mockReset();
    sdkMocks.checkPermission.mockReset();
    sdkMocks.deadlineInterceptor.mockClear();
    sdkMocks.deleteRelationships.mockReset();
    sdkMocks.diffSchema.mockReset();
    sdkMocks.lookupResources.mockReset();
    sdkMocks.newClient.mockReset();
    sdkMocks.readRelationships.mockReset();
    sdkMocks.readSchema.mockReset();
    sdkMocks.writeRelationships.mockReset();
    sdkMocks.writeSchema.mockReset();
    configMocks.isAuthzedEnabled.mockReset();
    retryMocks.execute.mockClear();
    envMock.AUTHZED_CONSISTENCY = undefined;
    envMock.AUTHZED_ENDPOINT = "spicedb:50051";
    envMock.AUTHZED_INSECURE = "true";
    envMock.AUTHZED_MINIMUM_SNAPSHOT = undefined;
    envMock.AUTHZED_SYSTEM_KEY = "formbricks";
    envMock.AUTHZED_TOKEN = "private-token";
    sdkMocks.newClient.mockReturnValue({
      close: sdkMocks.close,
      promises: {
        checkPermission: sdkMocks.checkPermission,
        deleteRelationships: sdkMocks.deleteRelationships,
        diffSchema: sdkMocks.diffSchema,
        lookupResources: sdkMocks.lookupResources,
        readRelationships: sdkMocks.readRelationships,
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
      "checkPermission",
      "consistency",
      "deleteRelationships",
      "diffSchema",
      "lookupResources",
      "readRelationships",
      "readSchema",
      "systemKey",
      "writeRelationships",
      "writeSchema",
    ]);
    expect(first).not.toHaveProperty("token");
    expect(first).not.toHaveProperty("promises");
    expect(first).not.toHaveProperty("close");
  });

  test("gives a bulk-configured process the long deadline on every call it makes", () => {
    // The deadline belongs to the channel, and every projector reaches the channel through
    // `getAuthzedClient()` rather than being handed one — so a command that both sweeps and writes gets
    // the bulk deadline on its writes too. That is the intent: the alternative is a sweep that dies on
    // its first slow page.
    configureAuthzedClientForBulkWork();

    getAuthzedClient();

    expect(sdkMocks.deadlineInterceptor).toHaveBeenCalledWith(30_000);
    expect(sdkMocks.newClient).toHaveBeenCalledWith(
      envMock.AUTHZED_TOKEN,
      envMock.AUTHZED_ENDPOINT,
      2,
      undefined,
      { interceptors: [{ timeoutMs: 30_000 }] }
    );
  });

  test("refuses to widen the deadline once a client exists, rather than silently leaving it short", () => {
    getAuthzedClient();

    expect(() => configureAuthzedClientForBulkWork()).toThrow(AuthzedError);
    expect(() => configureAuthzedClientForBulkWork()).toThrow(AUTHZED_ERROR_CODES.FAILED_PRECONDITION);
  });

  test("forgets the bulk deadline on close, so it cannot leak into a later client", () => {
    configureAuthzedClientForBulkWork();
    getAuthzedClient();

    closeAuthzedClient();
    getAuthzedClient();

    expect(sdkMocks.deadlineInterceptor).toHaveBeenLastCalledWith(1_000);
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

  test("checks permission with minimize-latency consistency and returns only the decision", async () => {
    sdkMocks.checkPermission.mockResolvedValue({
      checkedAt: { token: "private-revision" },
      permissionship: v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION,
    });

    await expect(
      getAuthzedClient().checkPermission({
        permission: "read",
        resource: { objectId: "workspace-1", objectType: "workspace" },
        subject: { objectId: "user-1", objectType: "user" },
      })
    ).resolves.toEqual({ allowed: true });

    expect(sdkMocks.checkPermission).toHaveBeenCalledWith({
      consistency: { requirement: { minimizeLatency: true, oneofKind: "minimizeLatency" } },
      context: undefined,
      permission: "read",
      resource: { objectId: "workspace-1", objectType: "workspace" },
      subject: {
        object: { objectId: "user-1", objectType: "user" },
        optionalRelation: "",
      },
      withTracing: false,
    });
    expect(retryMocks.execute).toHaveBeenCalledWith("check_permission", expect.any(Function));
  });

  test("looks up resources with permission-check consistency and returns sorted unique IDs", async () => {
    sdkMocks.lookupResources.mockResolvedValue([
      {
        afterResultCursor: { token: "private-cursor" },
        lookedUpAt: { token: "private-revision" },
        permissionship: v1.LookupPermissionship.HAS_PERMISSION,
        resourceObjectId: "workspace-2",
      },
      {
        permissionship: v1.LookupPermissionship.HAS_PERMISSION,
        resourceObjectId: "workspace-1",
      },
      {
        permissionship: v1.LookupPermissionship.HAS_PERMISSION,
        resourceObjectId: "workspace-2",
      },
    ]);

    await expect(
      getAuthzedClient().lookupResources({
        permission: "read",
        resourceType: "workspace",
        subject: { objectId: "user-1", objectType: "user" },
      })
    ).resolves.toEqual({ resourceIds: ["workspace-1", "workspace-2"] });

    expect(sdkMocks.lookupResources).toHaveBeenCalledWith({
      consistency: { requirement: { minimizeLatency: true, oneofKind: "minimizeLatency" } },
      context: undefined,
      optionalCursor: undefined,
      optionalLimit: AUTHZED_RESOURCE_LOOKUP_PAGE_SIZE,
      permission: "read",
      resourceObjectType: "workspace",
      subject: {
        object: { objectId: "user-1", objectType: "user" },
        optionalRelation: "",
      },
    });
    expect(retryMocks.execute).toHaveBeenCalledWith("lookup_resources", expect.any(Function));
  });

  test("pages resource lookups with a bounded stream allocation and an advancing cursor", async () => {
    const firstPage = Array.from({ length: AUTHZED_RESOURCE_LOOKUP_PAGE_SIZE }, (_unused, index) => ({
      afterResultCursor:
        index === AUTHZED_RESOURCE_LOOKUP_PAGE_SIZE - 1 ? { token: "lookup-cursor-1" } : undefined,
      permissionship: v1.LookupPermissionship.HAS_PERMISSION,
      resourceObjectId: `workspace-${index}`,
    }));
    sdkMocks.lookupResources.mockResolvedValueOnce(firstPage).mockResolvedValueOnce([
      {
        permissionship: v1.LookupPermissionship.HAS_PERMISSION,
        resourceObjectId: "workspace-final",
      },
    ]);

    const result = await getAuthzedClient().lookupResources({
      permission: "read",
      resourceType: "workspace",
      subject: { objectId: "user-1", objectType: "user" },
    });

    expect(result.resourceIds).toHaveLength(AUTHZED_RESOURCE_LOOKUP_PAGE_SIZE + 1);
    expect(sdkMocks.lookupResources).toHaveBeenCalledTimes(2);
    expect(sdkMocks.lookupResources.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        optionalCursor: undefined,
        optionalLimit: AUTHZED_RESOURCE_LOOKUP_PAGE_SIZE,
      })
    );
    expect(sdkMocks.lookupResources.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        optionalCursor: { token: "lookup-cursor-1" },
        optionalLimit: AUTHZED_RESOURCE_LOOKUP_PAGE_SIZE,
      })
    );
    expect(retryMocks.execute).toHaveBeenCalledTimes(2);
  });

  test("fails a resource lookup whose cursor does not advance", async () => {
    const fullPage = Array.from({ length: AUTHZED_RESOURCE_LOOKUP_PAGE_SIZE }, (_unused, index) => ({
      afterResultCursor:
        index === AUTHZED_RESOURCE_LOOKUP_PAGE_SIZE - 1 ? { token: "stalled-cursor" } : undefined,
      permissionship: v1.LookupPermissionship.HAS_PERMISSION,
      resourceObjectId: `workspace-${index}`,
    }));
    sdkMocks.lookupResources.mockResolvedValue(fullPage);

    await expect(
      getAuthzedClient().lookupResources({
        permission: "read",
        resourceType: "workspace",
        subject: { objectId: "user-1", objectType: "user" },
      })
    ).rejects.toMatchObject({
      code: AUTHZED_ERROR_CODES.INTERNAL,
      operation: "lookup_resources",
      retryable: false,
    });
    expect(sdkMocks.lookupResources).toHaveBeenCalledTimes(2);
  });

  test("fails instead of returning a truncated lookup beyond the accumulation bound", async () => {
    let page = 0;
    sdkMocks.lookupResources.mockImplementation(() => {
      page += 1;
      return Promise.resolve(
        Array.from({ length: AUTHZED_RESOURCE_LOOKUP_PAGE_SIZE }, (_unused, index) => ({
          afterResultCursor:
            index === AUTHZED_RESOURCE_LOOKUP_PAGE_SIZE - 1 ? { token: `cursor-${page}` } : undefined,
          permissionship: v1.LookupPermissionship.HAS_PERMISSION,
          resourceObjectId: `workspace-${page}-${index}`,
        }))
      );
    });

    await expect(
      getAuthzedClient().lookupResources({
        permission: "read",
        resourceType: "workspace",
        subject: { objectId: "user-1", objectType: "user" },
      })
    ).rejects.toMatchObject({
      code: AUTHZED_ERROR_CODES.LIMIT_EXCEEDED,
      operation: "lookup_resources",
      retryable: false,
    });
    expect(sdkMocks.lookupResources).toHaveBeenCalledTimes(
      Math.floor(AUTHZED_MAX_RESOURCE_LOOKUP_RESULTS / AUTHZED_RESOURCE_LOOKUP_PAGE_SIZE) + 1
    );
  });

  test.each([v1.LookupPermissionship.CONDITIONAL_PERMISSION, v1.LookupPermissionship.UNSPECIFIED])(
    "rejects unsupported lookup permissionship %s",
    async (permissionship) => {
      sdkMocks.lookupResources.mockResolvedValue([{ permissionship, resourceObjectId: "workspace-1" }]);

      await expect(
        getAuthzedClient().lookupResources({
          permission: "read",
          resourceType: "workspace",
          subject: { objectId: "user-1", objectType: "user" },
        })
      ).rejects.toMatchObject({
        code: AUTHZED_ERROR_CODES.UNSUPPORTED,
        operation: "lookup_resources",
        retryable: false,
      });
    }
  );

  test("rejects malformed lookup requests before constructing response data", async () => {
    await expect(
      getAuthzedClient().lookupResources({
        permission: "",
        resourceType: "workspace",
        subject: { objectId: "user-1", objectType: "user" },
      })
    ).rejects.toMatchObject({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.INVALID_REQUEST,
      operation: "lookup_resources",
    });
    expect(sdkMocks.lookupResources).not.toHaveBeenCalled();
  });

  test("uses the configured minimum snapshot as an at-least-as-fresh floor", async () => {
    envMock.AUTHZED_MINIMUM_SNAPSHOT = "backfill-snapshot";
    sdkMocks.checkPermission.mockResolvedValue({
      permissionship: v1.CheckPermissionResponse_Permissionship.NO_PERMISSION,
    });

    await expect(
      getAuthzedClient().checkPermission({
        permission: "write",
        resource: { objectId: "workspace-1", objectType: "workspace" },
        subject: { objectId: "key-1", objectType: "api_key" },
      })
    ).resolves.toEqual({ allowed: false });

    expect(sdkMocks.checkPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        consistency: {
          requirement: {
            atLeastAsFresh: { token: "backfill-snapshot" },
            oneofKind: "atLeastAsFresh",
          },
        },
      })
    );
  });

  test("uses fully-consistent permission checks when configured for enforcement", async () => {
    envMock.AUTHZED_CONSISTENCY = "fully_consistent";
    sdkMocks.checkPermission.mockResolvedValue({
      permissionship: v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION,
    });

    await getAuthzedClient().checkPermission({
      permission: "read",
      resource: { objectId: "organization-1", objectType: "organization" },
      subject: { objectId: "user-1", objectType: "user" },
    });

    expect(sdkMocks.checkPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        consistency: { requirement: { fullyConsistent: true, oneofKind: "fullyConsistent" } },
      })
    );
  });

  test.each([
    [
      "minimum snapshot",
      "minimize_latency" as const,
      "backfill-snapshot",
      {
        requirement: {
          atLeastAsFresh: { token: "backfill-snapshot" },
          oneofKind: "atLeastAsFresh",
        },
      },
    ],
    [
      "fully consistent",
      "fully_consistent" as const,
      undefined,
      { requirement: { fullyConsistent: true, oneofKind: "fullyConsistent" } },
    ],
  ])("uses %s consistency for resource lookup", async (_label, consistency, snapshot, expected) => {
    envMock.AUTHZED_CONSISTENCY = consistency;
    envMock.AUTHZED_MINIMUM_SNAPSHOT = snapshot;
    sdkMocks.lookupResources.mockResolvedValue([]);

    await getAuthzedClient().lookupResources({
      permission: "read",
      resourceType: "workspace",
      subject: { objectId: "user-1", objectType: "user" },
    });

    expect(sdkMocks.lookupResources).toHaveBeenCalledWith(expect.objectContaining({ consistency: expected }));
  });

  test.each([
    v1.CheckPermissionResponse_Permissionship.CONDITIONAL_PERMISSION,
    v1.CheckPermissionResponse_Permissionship.UNSPECIFIED,
  ])("rejects unsupported permission result %s", async (permissionship) => {
    sdkMocks.checkPermission.mockResolvedValue({ permissionship });

    await expect(
      getAuthzedClient().checkPermission({
        permission: "read",
        resource: { objectId: "workspace-1", objectType: "workspace" },
        subject: { objectId: "user-1", objectType: "user" },
      })
    ).rejects.toMatchObject({ code: AUTHZED_ERROR_CODES.UNSUPPORTED, retryable: false });
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
    sdkMocks.deleteRelationships.mockResolvedValue({
      deletedAt: { token: "private-revision" },
      deletionProgress: v1.DeleteRelationshipsResponse_DeletionProgress.COMPLETE,
    });

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

  test("refuses to report a partial deletion as a success", async () => {
    // The one facade call that destroys access. An unlimited, non-partial delete should always come
    // back COMPLETE, so PARTIAL means a server-side cap or a changed default is quietly leaving
    // relationships behind — and reporting that as done would leave a half-revoked graph.
    sdkMocks.deleteRelationships.mockResolvedValue({
      deletedAt: { token: "private-revision" },
      deletionProgress: v1.DeleteRelationshipsResponse_DeletionProgress.PARTIAL,
    });

    await expect(
      getAuthzedClient().deleteRelationships({ resourceId: "org-1", resourceType: "organization" })
    ).rejects.toMatchObject({ code: AUTHZED_ERROR_CODES.INTERNAL, retryable: true });
  });

  test("translates a subject-scoped bulk delete without broadening the resource filter", async () => {
    sdkMocks.deleteRelationships.mockResolvedValue({
      deletedAt: { token: "private-revision" },
      deletionProgress: v1.DeleteRelationshipsResponse_DeletionProgress.COMPLETE,
    });

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

  describe("readRelationships", () => {
    const readResponse = (
      relationship: Record<string, unknown>,
      overrides: Record<string, unknown> = {}
    ) => ({
      afterResultCursor: { token: "private-cursor" },
      readAt: { token: "private-revision" },
      relationship,
      ...overrides,
    });

    const membershipRelationship = {
      relation: "owner",
      resource: { objectId: "org-1", objectType: "organization" },
      subject: { object: { objectId: "user-1", objectType: "user" }, optionalRelation: "" },
    };

    test("resolves the first page fully consistently and returns a pinnable revision", async () => {
      sdkMocks.readRelationships.mockResolvedValue([readResponse(membershipRelationship)]);

      await expect(
        getAuthzedClient().readRelationships({
          filter: { resourceType: "organization" },
          limit: 250,
        })
      ).resolves.toEqual({
        // A short page exhausts the filter, so no cursor is offered even though SpiceDB sent one.
        cursor: null,
        relationships: [
          {
            relation: "owner",
            resource: { objectId: "org-1", objectType: "organization" },
            subject: { objectId: "user-1", objectType: "user" },
          },
        ],
        snapshot: { token: "private-revision" },
      });

      expect(sdkMocks.readRelationships).toHaveBeenCalledWith({
        consistency: { requirement: { fullyConsistent: true, oneofKind: "fullyConsistent" } },
        optionalCursor: undefined,
        optionalLimit: 250,
        relationshipFilter: {
          optionalRelation: "",
          optionalResourceId: "",
          optionalResourceIdPrefix: "",
          optionalSubjectFilter: undefined,
          resourceType: "organization",
        },
      });
      expect(retryMocks.execute).toHaveBeenCalledWith("read_relationships", expect.any(Function));
    });

    test("continues a cursored read without altering any other argument", async () => {
      sdkMocks.readRelationships.mockResolvedValue([
        readResponse(membershipRelationship, { readAt: { token: "revision-1" } }),
      ]);

      const page = await getAuthzedClient().readRelationships({
        cursor: { token: "resume-here" },
        filter: { resourceType: "organization" },
        limit: 250,
      });

      // SpiceDB rejects a cursor presented with any other changed argument, and the cursor already
      // carries the revision it was issued at — so the consistency requirement must stay put rather
      // than being swapped for an explicit snapshot on later pages.
      expect(page.snapshot).toEqual({ token: "revision-1" });
      expect(sdkMocks.readRelationships).toHaveBeenCalledWith(
        expect.objectContaining({
          consistency: { requirement: { fullyConsistent: true, oneofKind: "fullyConsistent" } },
          optionalCursor: { token: "resume-here" },
        })
      );
    });

    test("offers a resume cursor only when the page is full", async () => {
      sdkMocks.readRelationships.mockResolvedValue([
        readResponse(membershipRelationship),
        readResponse(membershipRelationship),
      ]);

      await expect(
        getAuthzedClient().readRelationships({
          filter: { resourceType: "organization" },
          limit: 2,
        })
      ).resolves.toMatchObject({ cursor: { token: "private-cursor" } });
    });

    test("returns an exhausted empty page without a revision", async () => {
      sdkMocks.readRelationships.mockResolvedValue([]);

      await expect(
        getAuthzedClient().readRelationships({
          filter: { resourceType: "organization" },
          limit: 250,
        })
      ).resolves.toEqual({ cursor: null, relationships: [], snapshot: null });
    });

    test("preserves a subject relation so team-member grants round-trip", async () => {
      sdkMocks.readRelationships.mockResolvedValue([
        readResponse({
          relation: "reader_team",
          resource: { objectId: "ws-1", objectType: "workspace" },
          subject: { object: { objectId: "team-1", objectType: "team" }, optionalRelation: "member" },
        }),
      ]);

      const page = await getAuthzedClient().readRelationships({
        filter: { resourceType: "workspace", subject: { objectId: "team-1", objectType: "team" } },
        limit: 250,
      });

      expect(page.relationships[0].subject).toEqual({
        objectId: "team-1",
        objectType: "team",
        relation: "member",
      });
    });

    test("narrows the SDK filter for every supported field", async () => {
      sdkMocks.readRelationships.mockResolvedValue([]);

      await getAuthzedClient().readRelationships({
        filter: {
          relation: "reader_team",
          resourceId: "ws-1",
          resourceType: "workspace",
          subject: { objectId: "team-1", objectType: "team", relation: "member" },
        },
        limit: 10,
      });

      expect(sdkMocks.readRelationships).toHaveBeenCalledWith(
        expect.objectContaining({
          relationshipFilter: {
            optionalRelation: "reader_team",
            optionalResourceId: "ws-1",
            optionalResourceIdPrefix: "",
            optionalSubjectFilter: {
              optionalRelation: { relation: "member" },
              optionalSubjectId: "team-1",
              subjectType: "team",
            },
            resourceType: "workspace",
          },
        })
      );
    });

    test.each([
      ["a missing resource type", { filter: { resourceType: "" }, limit: 10 }],
      // SpiceDB reads `optionalLimit: 0` as unlimited, which would breach the channel deadline and
      // buffer without bound, so an unset or non-positive limit must never reach the wire.
      ["an unlimited read", { filter: { resourceType: "organization" }, limit: 0 }],
      ["a negative limit", { filter: { resourceType: "organization" }, limit: -1 }],
      ["a fractional limit", { filter: { resourceType: "organization" }, limit: 1.5 }],
      ["a limit above the page bound", { filter: { resourceType: "organization" }, limit: 251 }],
      ["a blank relation", { filter: { relation: "", resourceType: "organization" }, limit: 10 }],
      ["a blank resource id", { filter: { resourceId: "", resourceType: "organization" }, limit: 10 }],
      [
        "an incomplete subject filter",
        {
          filter: { resourceType: "workspace", subject: { objectId: "", objectType: "team" } },
          limit: 10,
        },
      ],
      ["a blank cursor", { cursor: { token: "" }, filter: { resourceType: "organization" }, limit: 10 }],
    ])("rejects %s before reaching the SDK", async (_label, query) => {
      await expect(getAuthzedClient().readRelationships(query)).rejects.toThrow(
        AUTHZED_ERROR_CODES.INVALID_REQUEST
      );
      expect(sdkMocks.readRelationships).not.toHaveBeenCalled();
    });

    test.each([
      ["relationship", {}],
      ["resource", { relation: "owner", subject: membershipRelationship.subject }],
      ["subject object", { relation: "owner", resource: membershipRelationship.resource, subject: {} }],
    ])(
      "refuses a response missing its %s rather than reporting a malformed relationship",
      async (_label, relationship) => {
        sdkMocks.readRelationships.mockResolvedValue([readResponse(relationship)]);

        await expect(
          getAuthzedClient().readRelationships({
            filter: { resourceType: "organization" },
            limit: 250,
          })
        ).rejects.toThrow(AUTHZED_ERROR_CODES.INTERNAL);
      }
    );

    test("refuses a non-empty page that carries no revision to pin", async () => {
      sdkMocks.readRelationships.mockResolvedValue([
        readResponse(membershipRelationship, { readAt: undefined }),
      ]);

      await expect(
        getAuthzedClient().readRelationships({
          filter: { resourceType: "organization" },
          limit: 250,
        })
      ).rejects.toThrow(AUTHZED_ERROR_CODES.INTERNAL);
    });

    test.each(["optionalCaveat", "optionalExpiresAt"])(
      "refuses a relationship qualified by %s that the facade cannot represent",
      async (qualifier) => {
        sdkMocks.readRelationships.mockResolvedValue([
          readResponse({ ...membershipRelationship, [qualifier]: { anything: true } }),
        ]);

        await expect(
          getAuthzedClient().readRelationships({
            filter: { resourceType: "organization" },
            limit: 250,
          })
        ).rejects.toThrow(AUTHZED_ERROR_CODES.UNSUPPORTED);
      }
    );

    test("routes reads through the resilience pipeline so transient failures are mapped there", async () => {
      // Error sanitization belongs to `executeAuthzedOperation` (covered in retry.test.ts); the
      // facade's own contract is that it opts this operation into that pipeline rather than calling
      // the SDK bare.
      sdkMocks.readRelationships.mockRejectedValue(
        Object.assign(new Error("private-endpoint-detail"), { code: status.UNAVAILABLE })
      );

      await expect(
        getAuthzedClient().readRelationships({ filter: { resourceType: "organization" }, limit: 250 })
      ).rejects.toThrow();

      expect(retryMocks.execute).toHaveBeenCalledWith("read_relationships", expect.any(Function));
    });
  });
});
