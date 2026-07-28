import "server-only";
import type { TAuthzedClient, TAuthzedRelationshipUpdate } from "../lib/authzed/client";

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

type TSmokeCommand =
  | "delete"
  | "delete-manager-team"
  | "delete-workspace"
  | "downgrade-manager-grant"
  | "remove-alice-memberships"
  | "remove-reader-grant"
  | "seed-team-workspace"
  | "set-billing"
  | "set-owner";

const writeResult = (result: object): void => {
  process.stdout.write(`${JSON.stringify(result)}\n`);
};

const isSmokeCommand = (value: string | undefined): value is TSmokeCommand =>
  value === "delete" ||
  value === "delete-manager-team" ||
  value === "delete-workspace" ||
  value === "downgrade-manager-grant" ||
  value === "remove-alice-memberships" ||
  value === "remove-reader-grant" ||
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

const executeSmokeCommand = async (client: TAuthzedClient, command: TSmokeCommand): Promise<void> => {
  switch (command) {
    case "delete":
    case "set-billing":
    case "set-owner":
      await writeOrganizationProjection(client, command);
      return;
    case "seed-team-workspace":
      await seedTeamWorkspaceProjection(client);
      return;
    case "downgrade-manager-grant":
      await client.writeRelationships(createWorkspaceGrantUpdates(MANAGER_TEAM_ID, "reader_team"));
      return;
    case "remove-reader-grant":
      await client.writeRelationships(createWorkspaceGrantUpdates(READER_TEAM_ID));
      return;
    case "remove-alice-memberships":
      await client.writeRelationships([
        ...createTeamRoleUpdates(READER_TEAM_ID, ALICE_ID),
        ...createTeamRoleUpdates(MANAGER_TEAM_ID, ALICE_ID),
      ]);
      return;
    case "delete-manager-team":
      await deleteManagerTeamProjection(client);
      return;
    case "delete-workspace":
      await client.deleteRelationships({
        resourceId: GRAPH_WORKSPACE_ID,
        resourceType: "workspace",
      });
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
    await executeSmokeCommand(getAuthzedClient(), command);

    writeResult({ latencyMs: latencyMs(), status: "projected" });
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
