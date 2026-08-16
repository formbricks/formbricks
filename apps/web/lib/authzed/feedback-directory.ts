import "server-only";
import { prisma } from "@formbricks/database";
import type { TAuthzedClient, TAuthzedRelationshipUpdate } from "./client";
import { getAuthzedClient } from "./client";
import { getFeedbackDirectoryAssignmentObjectId } from "./feedback-directory-assignment-id";
import {
  AUTHZED_MAX_RECONCILIATION_PASSES,
  AuthzedProjectionInvalidSourceError,
  AuthzedProjectionUnstableError,
  type TAuthzedProjectionResult,
  runBestEffortProjection,
} from "./projection";
import { deleteRelationshipsInBoundedBatches, packRelationshipUpdateGroups } from "./relationship-batches";

export type TFeedbackDirectoryAssignmentProjectionTarget = Readonly<{
  feedbackDirectoryId: string;
  workspaceId: string;
}>;

export type TFeedbackDirectoryProjectionTargets = Readonly<{
  feedbackDirectoryIds?: ReadonlyArray<string>;
  assignments?: ReadonlyArray<TFeedbackDirectoryAssignmentProjectionTarget>;
}>;

type TNormalizedTargets = Readonly<{
  assignments: ReadonlyArray<TFeedbackDirectoryAssignmentProjectionTarget>;
  feedbackDirectoryIds: ReadonlyArray<string>;
  workspaceIds: ReadonlyArray<string>;
}>;

type TFeedbackDirectorySnapshot = Readonly<{
  assignments: ReadonlyArray<
    Readonly<{
      feedbackDirectoryId: string;
      feedbackDirectoryOrganizationId: string;
      isDirectoryArchived: boolean;
      workspaceId: string;
      workspaceOrganizationId: string;
    }>
  >;
  directories: ReadonlyArray<
    Readonly<{
      id: string;
      isArchived: boolean;
      organizationId: string;
    }>
  >;
  workspaces: ReadonlyArray<Readonly<{ id: string; organizationId: string }>>;
}>;

const pairKey = (feedbackDirectoryId: string, workspaceId: string): string =>
  `${feedbackDirectoryId.length}:${feedbackDirectoryId}${workspaceId.length}:${workspaceId}`;

const normalizeTargets = (targets: TFeedbackDirectoryProjectionTargets): TNormalizedTargets => {
  const assignments = new Map<string, TFeedbackDirectoryAssignmentProjectionTarget>();
  const feedbackDirectoryIds = new Set(targets.feedbackDirectoryIds ?? []);
  const workspaceIds = new Set<string>();

  for (const assignment of targets.assignments ?? []) {
    assignments.set(pairKey(assignment.feedbackDirectoryId, assignment.workspaceId), assignment);
    feedbackDirectoryIds.add(assignment.feedbackDirectoryId);
    workspaceIds.add(assignment.workspaceId);
  }

  return {
    assignments: [...assignments.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, assignment]) => assignment),
    feedbackDirectoryIds: [...feedbackDirectoryIds].sort((left, right) => left.localeCompare(right)),
    workspaceIds: [...workspaceIds].sort((left, right) => left.localeCompare(right)),
  };
};

const isEmpty = (targets: TNormalizedTargets): boolean => targets.feedbackDirectoryIds.length === 0;

const readSnapshot = async (targets: TNormalizedTargets): Promise<TFeedbackDirectorySnapshot> => {
  const [directories, explicitAssignments, explicitWorkspaces] = await Promise.all([
    prisma.feedbackDirectory.findMany({
      where: { id: { in: [...targets.feedbackDirectoryIds] } },
      select: {
        id: true,
        isArchived: true,
        organizationId: true,
        workspaces: {
          select: {
            workspace: { select: { organizationId: true } },
            workspaceId: true,
          },
          orderBy: { workspaceId: "asc" },
        },
      },
      orderBy: { id: "asc" },
    }),
    targets.assignments.length === 0
      ? []
      : prisma.feedbackDirectoryWorkspace.findMany({
          where: {
            OR: targets.assignments.map(({ feedbackDirectoryId, workspaceId }) => ({
              feedbackDirectoryId,
              workspaceId,
            })),
          },
          select: {
            feedbackDirectory: {
              select: { isArchived: true, organizationId: true },
            },
            feedbackDirectoryId: true,
            workspace: { select: { organizationId: true } },
            workspaceId: true,
          },
          orderBy: [{ feedbackDirectoryId: "asc" }, { workspaceId: "asc" }],
        }),
    targets.workspaceIds.length === 0
      ? []
      : prisma.workspace.findMany({
          where: { id: { in: [...targets.workspaceIds] } },
          select: { id: true, organizationId: true },
          orderBy: { id: "asc" },
        }),
  ]);

  const assignments = new Map<string, TFeedbackDirectorySnapshot["assignments"][number]>();
  const workspaces = new Map<string, TFeedbackDirectorySnapshot["workspaces"][number]>(
    explicitWorkspaces.map((workspace) => [workspace.id, workspace])
  );

  for (const directory of directories) {
    for (const assignment of directory.workspaces) {
      assignments.set(pairKey(directory.id, assignment.workspaceId), {
        feedbackDirectoryId: directory.id,
        feedbackDirectoryOrganizationId: directory.organizationId,
        isDirectoryArchived: directory.isArchived,
        workspaceId: assignment.workspaceId,
        workspaceOrganizationId: assignment.workspace.organizationId,
      });
      workspaces.set(assignment.workspaceId, {
        id: assignment.workspaceId,
        organizationId: assignment.workspace.organizationId,
      });
    }
  }
  for (const assignment of explicitAssignments) {
    assignments.set(pairKey(assignment.feedbackDirectoryId, assignment.workspaceId), {
      feedbackDirectoryId: assignment.feedbackDirectoryId,
      feedbackDirectoryOrganizationId: assignment.feedbackDirectory.organizationId,
      isDirectoryArchived: assignment.feedbackDirectory.isArchived,
      workspaceId: assignment.workspaceId,
      workspaceOrganizationId: assignment.workspace.organizationId,
    });
    workspaces.set(assignment.workspaceId, {
      id: assignment.workspaceId,
      organizationId: assignment.workspace.organizationId,
    });
  }

  return {
    assignments: [...assignments.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, assignment]) => assignment),
    directories: directories.map(({ id, isArchived, organizationId }) => ({
      id,
      isArchived,
      organizationId,
    })),
    workspaces: [...workspaces.values()].sort((left, right) => left.id.localeCompare(right.id)),
  };
};

const snapshotsMatch = (left: TFeedbackDirectorySnapshot, right: TFeedbackDirectorySnapshot): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const parentUpdate = (
  resourceType: "feedback_directory" | "workspace",
  resourceId: string,
  organizationId: string
): TAuthzedRelationshipUpdate => ({
  operation: "touch",
  relationship: {
    relation: "organization",
    resource: { objectId: resourceId, objectType: resourceType },
    subject: { objectId: organizationId, objectType: "organization" },
  },
});

const assignmentUpdates = (
  target: TFeedbackDirectoryAssignmentProjectionTarget,
  active: boolean
): ReadonlyArray<TAuthzedRelationshipUpdate> => {
  const assignmentId = getFeedbackDirectoryAssignmentObjectId(target.feedbackDirectoryId, target.workspaceId);
  const operation = active ? "touch" : "delete";

  return [
    {
      operation,
      relationship: {
        relation: "assignment",
        resource: { objectId: target.feedbackDirectoryId, objectType: "feedback_directory" },
        subject: { objectId: assignmentId, objectType: "feedback_directory_assignment" },
      },
    },
    {
      operation,
      relationship: {
        relation: "directory",
        resource: { objectId: assignmentId, objectType: "feedback_directory_assignment" },
        subject: { objectId: target.feedbackDirectoryId, objectType: "feedback_directory" },
      },
    },
    {
      operation,
      relationship: {
        relation: "workspace",
        resource: { objectId: assignmentId, objectType: "feedback_directory_assignment" },
        subject: { objectId: target.workspaceId, objectType: "workspace" },
      },
    },
  ];
};

const writeSnapshot = async (
  client: TAuthzedClient,
  targets: TNormalizedTargets,
  snapshot: TFeedbackDirectorySnapshot
): Promise<void> => {
  const currentAssignments = new Map(
    snapshot.assignments.map((assignment) => [
      pairKey(assignment.feedbackDirectoryId, assignment.workspaceId),
      assignment,
    ])
  );
  const allAssignmentTargets = new Map<string, TFeedbackDirectoryAssignmentProjectionTarget>();
  for (const target of targets.assignments) {
    allAssignmentTargets.set(pairKey(target.feedbackDirectoryId, target.workspaceId), target);
  }
  for (const assignment of snapshot.assignments) {
    allAssignmentTargets.set(pairKey(assignment.feedbackDirectoryId, assignment.workspaceId), {
      feedbackDirectoryId: assignment.feedbackDirectoryId,
      workspaceId: assignment.workspaceId,
    });
  }

  for (const assignment of snapshot.assignments) {
    if (assignment.feedbackDirectoryOrganizationId !== assignment.workspaceOrganizationId) {
      throw new AuthzedProjectionInvalidSourceError();
    }
  }

  const groups: TAuthzedRelationshipUpdate[][] = [];
  for (const directory of snapshot.directories) {
    groups.push([parentUpdate("feedback_directory", directory.id, directory.organizationId)]);
  }
  for (const workspace of snapshot.workspaces) {
    groups.push([parentUpdate("workspace", workspace.id, workspace.organizationId)]);
  }
  for (const [key, target] of [...allAssignmentTargets.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const current = currentAssignments.get(key);
    groups.push([...assignmentUpdates(target, current !== undefined && !current.isDirectoryArchived)]);
  }

  for (const batch of packRelationshipUpdateGroups(groups)) {
    await client.writeRelationships(batch);
  }

  const existingDirectoryIds = new Set(snapshot.directories.map(({ id }) => id));
  await deleteRelationshipsInBoundedBatches(
    client,
    targets.feedbackDirectoryIds
      .filter((id) => !existingDirectoryIds.has(id))
      .flatMap((id) => [
        { resourceId: id, resourceType: "feedback_directory" },
        {
          resourceType: "feedback_directory_assignment",
          subject: { objectId: id, objectType: "feedback_directory" },
        },
      ])
  );
};

export const reconcileFeedbackDirectoryRelationships = async (
  targets: TFeedbackDirectoryProjectionTargets
): Promise<TAuthzedProjectionResult> =>
  runBestEffortProjection("reconcile_feedback_directory_relationships", "feedback_directory", async () => {
    const normalizedTargets = normalizeTargets(targets);
    if (isEmpty(normalizedTargets)) {
      return 0;
    }

    const client = getAuthzedClient();
    for (let pass = 1; pass <= AUTHZED_MAX_RECONCILIATION_PASSES; pass++) {
      const sourceSnapshot = await readSnapshot(normalizedTargets);
      await writeSnapshot(client, normalizedTargets, sourceSnapshot);
      const verifiedSnapshot = await readSnapshot(normalizedTargets);
      if (snapshotsMatch(sourceSnapshot, verifiedSnapshot)) {
        return pass;
      }
    }

    throw new AuthzedProjectionUnstableError();
  });

/** Full-deployment prune for an unattributable hashed assignment resource. */
export const deleteFeedbackDirectoryAssignmentRelationships = async (
  assignmentIds: ReadonlyArray<string>
): Promise<TAuthzedProjectionResult> =>
  runBestEffortProjection(
    "delete_feedback_directory_assignment_relationships",
    "feedback_directory",
    async () => {
      const uniqueIds = [...new Set(assignmentIds)].sort((left, right) => left.localeCompare(right));
      if (uniqueIds.length === 0) {
        return 0;
      }
      const client = getAuthzedClient();
      await deleteRelationshipsInBoundedBatches(
        client,
        uniqueIds.flatMap((assignmentId) => [
          { resourceId: assignmentId, resourceType: "feedback_directory_assignment" },
          {
            resourceType: "feedback_directory",
            subject: { objectId: assignmentId, objectType: "feedback_directory_assignment" },
          },
        ])
      );
      return 1;
    }
  );
