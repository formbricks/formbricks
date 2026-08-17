import "server-only";
import type { TAuthzedClient, TAuthzedRelationshipUpdate } from "../lib/authzed/client";
import { getFeedbackDirectoryAssignmentObjectId } from "../lib/authzed/feedback-directory-assignment-id";

const ORGANIZATION_ID = "application-relationship-smoke";
const USER_ID = "application-relationship-smoke";
const ORGANIZATION_RELATIONS = ["billing", "manager", "member", "owner"] as const;
const GRAPH_ORGANIZATION_ID = "application-graph-smoke";
const GRAPH_WORKSPACE_ID = "application-graph-smoke";
const READER_TEAM_ID = "application-graph-reader";
const MANAGER_TEAM_ID = "application-graph-manager";
const ALICE_ID = "application-graph-alice";
const BOB_ID = "application-graph-bob";
const TEAM_RELATIONS = ["admin", "contributor"] as const;
const WORKSPACE_TEAM_RELATIONS = ["manager_team", "reader_team", "writer_team"] as const;
const API_KEY_ORGANIZATION_ID = "application-api-key-organization";
const PRIMARY_API_KEY_WORKSPACE_ID = "application-api-key-primary";
const SECONDARY_API_KEY_WORKSPACE_ID = "application-api-key-secondary";
const READER_API_KEY_ID = "application-api-key-reader";
const WRITER_API_KEY_ID = "application-api-key-writer";
const MANAGER_API_KEY_ID = "application-api-key-manager";
const COMBINED_ACCESS_API_KEY_ID = "application-api-key-combined-access";
const API_KEY_ORGANIZATION_RELATIONS = ["api_key_reader", "api_key_writer"] as const;
const API_KEY_WORKSPACE_RELATIONS = ["manager", "reader", "writer"] as const;
const FEEDBACK_ORGANIZATION_ID = "application-feedback-organization";
const FEEDBACK_DIRECTORY_ID = "application-feedback-directory";
const FEEDBACK_WORKSPACE_A_ID = "application-feedback-workspace-a";
const FEEDBACK_WORKSPACE_B_ID = "application-feedback-workspace-b";
const FEEDBACK_TEAM_ID = "application-feedback-team";
const FEEDBACK_USER_ID = "application-feedback-user";
const FEEDBACK_MANAGER_ID = "application-feedback-manager";
const FEEDBACK_API_KEY_ID = "application-feedback-api-key";

type TSmokeCommand =
  | "check-api-key-allow"
  | "check-api-key-deny"
  | "check-user-allow"
  | "check-user-deny"
  | "check-feedback"
  | "delete"
  | "delete-api-key"
  | "delete-manager-team"
  | "delete-workspace"
  | "delete-feedback-assignment-a"
  | "delete-feedback-directory"
  | "downgrade-feedback-api-key"
  | "downgrade-api-key-manager"
  | "downgrade-manager-grant"
  | "remove-alice-memberships"
  | "remove-api-key-scope"
  | "remove-reader-grant"
  | "remove-feedback-user-membership"
  | "seed-api-key"
  | "seed-feedback-directory"
  | "seed-team-workspace"
  | "set-billing"
  | "set-owner";

const writeResult = (result: object): void => {
  process.stdout.write(`${JSON.stringify(result)}\n`);
};

const isSmokeCommand = (value: string | undefined): value is TSmokeCommand =>
  value === "check-api-key-allow" ||
  value === "check-api-key-deny" ||
  value === "check-user-allow" ||
  value === "check-user-deny" ||
  value === "check-feedback" ||
  value === "delete" ||
  value === "delete-api-key" ||
  value === "delete-manager-team" ||
  value === "delete-workspace" ||
  value === "delete-feedback-assignment-a" ||
  value === "delete-feedback-directory" ||
  value === "downgrade-feedback-api-key" ||
  value === "downgrade-api-key-manager" ||
  value === "downgrade-manager-grant" ||
  value === "remove-alice-memberships" ||
  value === "remove-api-key-scope" ||
  value === "remove-reader-grant" ||
  value === "remove-feedback-user-membership" ||
  value === "seed-api-key" ||
  value === "seed-feedback-directory" ||
  value === "seed-team-workspace" ||
  value === "set-billing" ||
  value === "set-owner";

const createTeamRoleUpdates = (
  teamId: string,
  userId: string,
  selectedRelation?: (typeof TEAM_RELATIONS)[number]
): ReadonlyArray<TAuthzedRelationshipUpdate> =>
  TEAM_RELATIONS.map((relation) => ({
    operation: relation === selectedRelation ? "touch" : "delete",
    relationship: {
      relation,
      resource: { objectId: teamId, objectType: "team" },
      subject: { objectId: userId, objectType: "user" },
    },
  }));

const createWorkspaceGrantUpdates = (
  teamId: string,
  selectedRelation?: (typeof WORKSPACE_TEAM_RELATIONS)[number]
): ReadonlyArray<TAuthzedRelationshipUpdate> =>
  WORKSPACE_TEAM_RELATIONS.map((relation) => ({
    operation: relation === selectedRelation ? "touch" : "delete",
    relationship: {
      relation,
      resource: { objectId: GRAPH_WORKSPACE_ID, objectType: "workspace" },
      subject: { objectId: teamId, objectType: "team", relation: "member" },
    },
  }));

const createApiKeyOrganizationAccessUpdates = (
  apiKeyId: string,
  selectedRelations: ReadonlyArray<(typeof API_KEY_ORGANIZATION_RELATIONS)[number]> = []
): ReadonlyArray<TAuthzedRelationshipUpdate> =>
  API_KEY_ORGANIZATION_RELATIONS.map((relation) => ({
    operation: selectedRelations.includes(relation) ? "touch" : "delete",
    relationship: {
      relation,
      resource: { objectId: API_KEY_ORGANIZATION_ID, objectType: "organization" },
      subject: { objectId: apiKeyId, objectType: "api_key" },
    },
  }));

const createApiKeyWorkspaceUpdates = (
  apiKeyId: string,
  workspaceId: string,
  selectedRelation?: (typeof API_KEY_WORKSPACE_RELATIONS)[number]
): ReadonlyArray<TAuthzedRelationshipUpdate> =>
  API_KEY_WORKSPACE_RELATIONS.map((relation) => ({
    operation: relation === selectedRelation ? "touch" : "delete",
    relationship: {
      relation,
      resource: { objectId: workspaceId, objectType: "workspace" },
      subject: { objectId: apiKeyId, objectType: "api_key" },
    },
  }));

const writeOrganizationProjection = async (
  client: TAuthzedClient,
  command: "delete" | "set-billing" | "set-owner"
): Promise<void> => {
  const selectedRelations = {
    delete: undefined,
    "set-billing": "billing",
    "set-owner": "owner",
  } as const;

  await client.writeRelationships(
    ORGANIZATION_RELATIONS.map((relation) => ({
      operation: selectedRelations[command] === relation ? "touch" : "delete",
      relationship: {
        relation,
        resource: { objectId: ORGANIZATION_ID, objectType: "organization" },
        subject: { objectId: USER_ID, objectType: "user" },
      },
    }))
  );
};

const seedTeamWorkspaceProjection = async (client: TAuthzedClient): Promise<void> => {
  await client.writeRelationships([
    ...[ALICE_ID, BOB_ID].map((userId) => ({
      operation: "touch" as const,
      relationship: {
        relation: "member",
        resource: { objectId: GRAPH_ORGANIZATION_ID, objectType: "organization" },
        subject: { objectId: userId, objectType: "user" },
      },
    })),
    {
      operation: "touch",
      relationship: {
        relation: "organization",
        resource: { objectId: READER_TEAM_ID, objectType: "team" },
        subject: { objectId: GRAPH_ORGANIZATION_ID, objectType: "organization" },
      },
    },
    {
      operation: "touch",
      relationship: {
        relation: "organization",
        resource: { objectId: MANAGER_TEAM_ID, objectType: "team" },
        subject: { objectId: GRAPH_ORGANIZATION_ID, objectType: "organization" },
      },
    },
    {
      operation: "touch",
      relationship: {
        relation: "organization",
        resource: { objectId: GRAPH_WORKSPACE_ID, objectType: "workspace" },
        subject: { objectId: GRAPH_ORGANIZATION_ID, objectType: "organization" },
      },
    },
    ...createTeamRoleUpdates(READER_TEAM_ID, ALICE_ID, "contributor"),
    ...createTeamRoleUpdates(MANAGER_TEAM_ID, ALICE_ID, "admin"),
    ...createTeamRoleUpdates(READER_TEAM_ID, BOB_ID, "contributor"),
    ...createWorkspaceGrantUpdates(READER_TEAM_ID, "reader_team"),
    ...createWorkspaceGrantUpdates(MANAGER_TEAM_ID, "manager_team"),
  ]);
};

const deleteManagerTeamProjection = async (client: TAuthzedClient): Promise<void> => {
  await client.deleteRelationships({
    resourceId: MANAGER_TEAM_ID,
    resourceType: "team",
  });
  await client.deleteRelationships({
    resourceType: "workspace",
    subject: { objectId: MANAGER_TEAM_ID, objectType: "team", relation: "member" },
  });
};

const seedApiKeyProjection = async (client: TAuthzedClient): Promise<void> => {
  await client.writeRelationships([
    ...[READER_API_KEY_ID, WRITER_API_KEY_ID, MANAGER_API_KEY_ID, COMBINED_ACCESS_API_KEY_ID].map(
      (apiKeyId) => ({
        operation: "touch" as const,
        relationship: {
          relation: "organization",
          resource: { objectId: apiKeyId, objectType: "api_key" },
          subject: { objectId: API_KEY_ORGANIZATION_ID, objectType: "organization" },
        },
      })
    ),
    {
      operation: "touch",
      relationship: {
        relation: "organization",
        resource: { objectId: PRIMARY_API_KEY_WORKSPACE_ID, objectType: "workspace" },
        subject: { objectId: API_KEY_ORGANIZATION_ID, objectType: "organization" },
      },
    },
    {
      operation: "touch",
      relationship: {
        relation: "organization",
        resource: { objectId: SECONDARY_API_KEY_WORKSPACE_ID, objectType: "workspace" },
        subject: { objectId: API_KEY_ORGANIZATION_ID, objectType: "organization" },
      },
    },
    ...createApiKeyOrganizationAccessUpdates(READER_API_KEY_ID, ["api_key_reader"]),
    ...createApiKeyOrganizationAccessUpdates(WRITER_API_KEY_ID, ["api_key_writer"]),
    ...createApiKeyOrganizationAccessUpdates(MANAGER_API_KEY_ID),
    ...createApiKeyOrganizationAccessUpdates(COMBINED_ACCESS_API_KEY_ID, [
      "api_key_reader",
      "api_key_writer",
    ]),
    ...createApiKeyWorkspaceUpdates(READER_API_KEY_ID, PRIMARY_API_KEY_WORKSPACE_ID, "reader"),
    ...createApiKeyWorkspaceUpdates(WRITER_API_KEY_ID, PRIMARY_API_KEY_WORKSPACE_ID, "writer"),
    ...createApiKeyWorkspaceUpdates(MANAGER_API_KEY_ID, PRIMARY_API_KEY_WORKSPACE_ID, "manager"),
    ...createApiKeyWorkspaceUpdates(MANAGER_API_KEY_ID, SECONDARY_API_KEY_WORKSPACE_ID, "reader"),
  ]);
};

const deleteWriterApiKeyProjection = async (client: TAuthzedClient): Promise<void> => {
  await client.deleteRelationships({
    resourceId: WRITER_API_KEY_ID,
    resourceType: "api_key",
  });
  await client.deleteRelationships({
    resourceType: "organization",
    subject: { objectId: WRITER_API_KEY_ID, objectType: "api_key" },
  });
  await client.deleteRelationships({
    resourceType: "workspace",
    subject: { objectId: WRITER_API_KEY_ID, objectType: "api_key" },
  });
};

const feedbackAssignmentUpdates = (
  workspaceId: string,
  operation: "delete" | "touch"
): ReadonlyArray<TAuthzedRelationshipUpdate> => {
  const assignmentId = getFeedbackDirectoryAssignmentObjectId(FEEDBACK_DIRECTORY_ID, workspaceId);
  return [
    {
      operation,
      relationship: {
        relation: "assignment",
        resource: { objectId: FEEDBACK_DIRECTORY_ID, objectType: "feedback_directory" },
        subject: { objectId: assignmentId, objectType: "feedback_directory_assignment" },
      },
    },
    {
      operation,
      relationship: {
        relation: "directory",
        resource: { objectId: assignmentId, objectType: "feedback_directory_assignment" },
        subject: { objectId: FEEDBACK_DIRECTORY_ID, objectType: "feedback_directory" },
      },
    },
    {
      operation,
      relationship: {
        relation: "workspace",
        resource: { objectId: assignmentId, objectType: "feedback_directory_assignment" },
        subject: { objectId: workspaceId, objectType: "workspace" },
      },
    },
  ];
};

const seedFeedbackDirectoryProjection = async (client: TAuthzedClient): Promise<void> => {
  await client.writeRelationships([
    {
      operation: "touch",
      relationship: {
        relation: "manager",
        resource: { objectId: FEEDBACK_ORGANIZATION_ID, objectType: "organization" },
        subject: { objectId: FEEDBACK_MANAGER_ID, objectType: "user" },
      },
    },
    {
      operation: "touch",
      relationship: {
        relation: "member",
        resource: { objectId: FEEDBACK_ORGANIZATION_ID, objectType: "organization" },
        subject: { objectId: FEEDBACK_USER_ID, objectType: "user" },
      },
    },
    {
      operation: "touch",
      relationship: {
        relation: "organization",
        resource: { objectId: FEEDBACK_TEAM_ID, objectType: "team" },
        subject: { objectId: FEEDBACK_ORGANIZATION_ID, objectType: "organization" },
      },
    },
    ...[FEEDBACK_WORKSPACE_A_ID, FEEDBACK_WORKSPACE_B_ID].map((workspaceId) => ({
      operation: "touch" as const,
      relationship: {
        relation: "organization",
        resource: { objectId: workspaceId, objectType: "workspace" },
        subject: { objectId: FEEDBACK_ORGANIZATION_ID, objectType: "organization" },
      },
    })),
    {
      operation: "touch",
      relationship: {
        relation: "contributor",
        resource: { objectId: FEEDBACK_TEAM_ID, objectType: "team" },
        subject: { objectId: FEEDBACK_USER_ID, objectType: "user" },
      },
    },
    {
      operation: "touch",
      relationship: {
        relation: "reader_team",
        resource: { objectId: FEEDBACK_WORKSPACE_A_ID, objectType: "workspace" },
        subject: { objectId: FEEDBACK_TEAM_ID, objectType: "team", relation: "member" },
      },
    },
    {
      operation: "touch",
      relationship: {
        relation: "organization",
        resource: { objectId: FEEDBACK_API_KEY_ID, objectType: "api_key" },
        subject: { objectId: FEEDBACK_ORGANIZATION_ID, objectType: "organization" },
      },
    },
    ...createApiKeyWorkspaceUpdates(FEEDBACK_API_KEY_ID, FEEDBACK_WORKSPACE_B_ID, "writer"),
    {
      operation: "touch",
      relationship: {
        relation: "organization",
        resource: { objectId: FEEDBACK_DIRECTORY_ID, objectType: "feedback_directory" },
        subject: { objectId: FEEDBACK_ORGANIZATION_ID, objectType: "organization" },
      },
    },
    ...feedbackAssignmentUpdates(FEEDBACK_WORKSPACE_A_ID, "touch"),
    ...feedbackAssignmentUpdates(FEEDBACK_WORKSPACE_B_ID, "touch"),
  ]);
};

const checkFeedbackDirectoryProjection = async (client: TAuthzedClient) => {
  const check = (
    permission: string,
    resourceType: string,
    resourceId: string,
    subjectType: string,
    subjectId: string
  ) =>
    client.checkPermission({
      permission,
      resource: { objectId: resourceId, objectType: resourceType },
      subject: { objectId: subjectId, objectType: subjectType },
    });
  const assignmentA = getFeedbackDirectoryAssignmentObjectId(FEEDBACK_DIRECTORY_ID, FEEDBACK_WORKSPACE_A_ID);
  const assignmentB = getFeedbackDirectoryAssignmentObjectId(FEEDBACK_DIRECTORY_ID, FEEDBACK_WORKSPACE_B_ID);
  const [
    managerManage,
    userRead,
    userWrite,
    userAssignmentARead,
    userAssignmentBRead,
    keyWrite,
    keyAssignmentAWrite,
    keyAssignmentBWrite,
  ] = await Promise.all([
    check("manage", "feedback_directory", FEEDBACK_DIRECTORY_ID, "user", FEEDBACK_MANAGER_ID),
    check("read", "feedback_directory", FEEDBACK_DIRECTORY_ID, "user", FEEDBACK_USER_ID),
    check("write", "feedback_directory", FEEDBACK_DIRECTORY_ID, "user", FEEDBACK_USER_ID),
    check("read", "feedback_directory_assignment", assignmentA, "user", FEEDBACK_USER_ID),
    check("read", "feedback_directory_assignment", assignmentB, "user", FEEDBACK_USER_ID),
    check("write", "feedback_directory", FEEDBACK_DIRECTORY_ID, "api_key", FEEDBACK_API_KEY_ID),
    check("write", "feedback_directory_assignment", assignmentA, "api_key", FEEDBACK_API_KEY_ID),
    check("write", "feedback_directory_assignment", assignmentB, "api_key", FEEDBACK_API_KEY_ID),
  ]);

  return {
    keyAssignmentAWrite: keyAssignmentAWrite.allowed,
    keyAssignmentBWrite: keyAssignmentBWrite.allowed,
    keyWrite: keyWrite.allowed,
    managerManage: managerManage.allowed,
    status: "checked" as const,
    userAssignmentARead: userAssignmentARead.allowed,
    userAssignmentBRead: userAssignmentBRead.allowed,
    userRead: userRead.allowed,
    userWrite: userWrite.allowed,
  };
};

type TSmokeResult =
  | Readonly<{ status: "projected" }>
  | Readonly<{ allowed: boolean; status: "checked" }>
  | Awaited<ReturnType<typeof checkFeedbackDirectoryProjection>>;

const executeSmokeCommand = async (client: TAuthzedClient, command: TSmokeCommand): Promise<TSmokeResult> => {
  switch (command) {
    case "check-user-allow":
    case "check-user-deny":
      return {
        ...(await client.checkPermission({
          permission: "manage",
          resource: { objectId: GRAPH_WORKSPACE_ID, objectType: "workspace" },
          subject: {
            objectId: command === "check-user-allow" ? ALICE_ID : BOB_ID,
            objectType: "user",
          },
        })),
        status: "checked",
      };
    case "check-api-key-allow":
    case "check-api-key-deny":
      return {
        ...(await client.checkPermission({
          permission: "manage_access",
          resource: { objectId: API_KEY_ORGANIZATION_ID, objectType: "organization" },
          subject: {
            objectId: command === "check-api-key-allow" ? WRITER_API_KEY_ID : READER_API_KEY_ID,
            objectType: "api_key",
          },
        })),
        status: "checked",
      };
    case "check-feedback":
      return checkFeedbackDirectoryProjection(client);
    case "delete":
    case "set-billing":
    case "set-owner":
      await writeOrganizationProjection(client, command);
      return { status: "projected" };
    case "seed-team-workspace":
      await seedTeamWorkspaceProjection(client);
      return { status: "projected" };
    case "seed-api-key":
      await seedApiKeyProjection(client);
      return { status: "projected" };
    case "seed-feedback-directory":
      await seedFeedbackDirectoryProjection(client);
      return { status: "projected" };
    case "downgrade-feedback-api-key":
      await client.writeRelationships(
        createApiKeyWorkspaceUpdates(FEEDBACK_API_KEY_ID, FEEDBACK_WORKSPACE_B_ID, "reader")
      );
      return { status: "projected" };
    case "remove-feedback-user-membership":
      await client.writeRelationships(createTeamRoleUpdates(FEEDBACK_TEAM_ID, FEEDBACK_USER_ID));
      return { status: "projected" };
    case "delete-feedback-assignment-a":
      await client.writeRelationships(feedbackAssignmentUpdates(FEEDBACK_WORKSPACE_A_ID, "delete"));
      return { status: "projected" };
    case "delete-feedback-directory":
      await client.deleteRelationships({
        resourceId: FEEDBACK_DIRECTORY_ID,
        resourceType: "feedback_directory",
      });
      for (const workspaceId of [FEEDBACK_WORKSPACE_A_ID, FEEDBACK_WORKSPACE_B_ID]) {
        await client.deleteRelationships({
          resourceId: getFeedbackDirectoryAssignmentObjectId(FEEDBACK_DIRECTORY_ID, workspaceId),
          resourceType: "feedback_directory_assignment",
        });
      }
      return { status: "projected" };
    case "downgrade-api-key-manager":
      await client.writeRelationships(
        createApiKeyWorkspaceUpdates(MANAGER_API_KEY_ID, PRIMARY_API_KEY_WORKSPACE_ID, "writer")
      );
      return { status: "projected" };
    case "remove-api-key-scope":
      await client.writeRelationships(
        createApiKeyWorkspaceUpdates(MANAGER_API_KEY_ID, SECONDARY_API_KEY_WORKSPACE_ID)
      );
      return { status: "projected" };
    case "delete-api-key":
      await deleteWriterApiKeyProjection(client);
      return { status: "projected" };
    case "downgrade-manager-grant":
      await client.writeRelationships(createWorkspaceGrantUpdates(MANAGER_TEAM_ID, "reader_team"));
      return { status: "projected" };
    case "remove-reader-grant":
      await client.writeRelationships(createWorkspaceGrantUpdates(READER_TEAM_ID));
      return { status: "projected" };
    case "remove-alice-memberships":
      await client.writeRelationships([
        ...createTeamRoleUpdates(READER_TEAM_ID, ALICE_ID),
        ...createTeamRoleUpdates(MANAGER_TEAM_ID, ALICE_ID),
      ]);
      return { status: "projected" };
    case "delete-manager-team":
      await deleteManagerTeamProjection(client);
      return { status: "projected" };
    case "delete-workspace":
      await client.deleteRelationships({
        resourceId: GRAPH_WORKSPACE_ID,
        resourceType: "workspace",
      });
      return { status: "projected" };
  }
};

const run = async (): Promise<void> => {
  const startedAt = performance.now();
  const latencyMs = (): number => Math.max(0, Math.round(performance.now() - startedAt));

  if (process.env.NODE_ENV !== "test") {
    writeResult({
      code: "authzed_smoke_refused",
      latencyMs: latencyMs(),
      retryable: false,
      status: "failed",
    });
    process.exitCode = 1;
    return;
  }

  const command = process.argv[2];
  if (!isSmokeCommand(command)) {
    writeResult({
      code: "authzed_invalid_request",
      latencyMs: latencyMs(),
      retryable: false,
      status: "failed",
    });
    process.exitCode = 1;
    return;
  }

  let closeClient: (() => void) | undefined;

  try {
    const { closeAuthzedClient, getAuthzedClient } = await import("../lib/authzed/client");
    closeClient = closeAuthzedClient;
    const result = await executeSmokeCommand(getAuthzedClient(), command);

    writeResult({ ...result, latencyMs: latencyMs() });
    process.exitCode = 0;
  } catch (error) {
    const { AuthzedError } = await import("../lib/authzed/errors");

    if (error instanceof AuthzedError) {
      writeResult({
        attempts: error.attempts,
        code: error.code,
        latencyMs: latencyMs(),
        retryable: error.retryable,
        status: "failed",
      });
    } else {
      writeResult({
        code: "authzed_internal",
        latencyMs: latencyMs(),
        retryable: false,
        status: "failed",
      });
    }
    process.exitCode = 1;
  } finally {
    closeClient?.();
  }
};

void run();
