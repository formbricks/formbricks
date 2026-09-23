import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import {
  DatabaseError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { TWorkspace, TWorkspaceUpdateInput, ZWorkspaceUpdateInput } from "@formbricks/types/workspace";
import { reconcileFeedbackDirectoryRelationships } from "@/lib/authzed/feedback-directory";
import { runPostCommitProjection } from "@/lib/authzed/projection-boundary";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { isPrismaKnownRequestError, isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { validateInputs } from "@/lib/utils/validate";
import { getWorkspaceLegacyStoragePrefixes } from "@/lib/workspace/service";
import { deleteFile, deleteWorkspaceFilesBestEffort } from "@/modules/storage/service";
import { parseStorageFileUrl } from "@/modules/storage/utils";

// Keep v5 defaults aligned with current production camelCase keys.
// Safe-identifier migration (with backwards compatibility) is intentionally deferred to v5.1.
const DEFAULT_CONTACT_ATTRIBUTE_KEYS: Prisma.ContactAttributeKeyCreateWithoutWorkspaceInput[] = [
  {
    key: "userId",
    name: "User Id",
    description: "The user id of a contact",
    type: "default",
    isUnique: true,
  },
  {
    key: "email",
    name: "Email",
    description: "The email of a contact",
    type: "default",
    isUnique: true,
  },
  {
    key: "firstName",
    name: "First Name",
    description: "Your contact's first name",
    type: "default",
  },
  {
    key: "lastName",
    name: "Last Name",
    description: "Your contact's last name",
    type: "default",
  },
  {
    key: "language",
    name: "Language",
    description: "The language preference of a contact",
    type: "default",
  },
];

const DEFAULT_WORKSPACE_LANGUAGE: Prisma.LanguageCreateWithoutWorkspaceInput = {
  code: DEFAULT_LOCALE,
  alias: null,
};

const selectWorkspace = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  organizationId: true,
  languages: true,
  recontactDays: true,
  linkSurveyBranding: true,
  inAppSurveyBranding: true,
  config: true,
  placement: true,
  clickOutsideClose: true,
  overlay: true,
  appSetupCompleted: true,
  styling: true,
  logo: true,
  customHeadScripts: true,
};

/**
 * Deletes the storage object a removed or replaced workspace logo used to point at.
 *
 * `logo.url` arrives through the update input and `parseStorageFileUrl` derives the storage id from
 * the URL itself without checking its origin, so that id alone decides whose object gets deleted.
 * Acting on it unguarded would be a cross-tenant delete primitive: point the logo at another
 * workspace's storage URL, clear it, and the app removes their file. So the parsed id is checked
 * against the prefixes this workspace actually owns first — the same guard ENG-1981 and ENG-2258
 * put on response files.
 *
 * Best-effort: the user asked to change the logo, and the database already says so. A storage
 * failure is logged and never thrown, or a dead bucket would fail an update that did happen.
 */
const deleteOrphanedWorkspaceLogoFile = async (workspaceId: string, previousUrl: string) => {
  try {
    const storageFile = parseStorageFileUrl(previousUrl);
    // An external logo URL (a CDN link, which the UI supports) is not ours to delete.
    if (!storageFile) return;

    const ownedPrefixes = await getWorkspaceLegacyStoragePrefixes(workspaceId);
    if (!ownedPrefixes.includes(storageFile.storageId)) {
      logger.error(
        { workspaceId, storageId: storageFile.storageId },
        "Refusing to delete a workspace logo stored outside the workspace"
      );
      return;
    }

    // Owning the prefix says the object is this workspace's, not that it is a logo — `logo.url` is
    // caller-supplied, so it can name any object under that prefix. Logo uploads always go through
    // the management storage route, which issues `public` keys, so refusing anything else keeps this
    // path away from `private/` objects (response attachments) even when the url is chosen.
    if (storageFile.accessType !== "public") {
      logger.error(
        { workspaceId, accessType: storageFile.accessType },
        "Refusing to delete a non-public object through workspace logo cleanup"
      );
      return;
    }

    // Upload percent-encodes the file name into the URL, but the object is stored under the decoded
    // name, so a logo called "my logo.png" misses its key entirely unless it is decoded here.
    const result = await deleteFile(
      storageFile.storageId,
      storageFile.accessType,
      decodeURIComponent(storageFile.fileName)
    );

    if (!result.ok) {
      logger.error({ workspaceId, error: result.error }, "Failed to delete the previous workspace logo");
    }
  } catch (error) {
    logger.error({ error, workspaceId }, "Failed to delete the previous workspace logo");
  }
};

export const updateWorkspace = async (
  workspaceId: string,
  inputWorkspace: TWorkspaceUpdateInput
): Promise<TWorkspace> => {
  validateInputs([workspaceId, ZId], [inputWorkspace, ZWorkspaceUpdateInput]);
  // ENG-1919: organizationId is the workspace's tenant anchor, set at creation and immutable on
  // update. Persisting a caller-supplied organizationId here would let an authorized workspace
  // owner move their workspace (and all its data) into another organization, so it is stripped.
  const { organizationId: _organizationId, ...data } = inputWorkspace;
  let updatedWorkspace;
  let previousLogoUrl: string | undefined;
  try {
    // Only an update carrying a logo can orphan one, so a rename or a styling change costs no read.
    if ("logo" in inputWorkspace) {
      const current = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { logo: true },
      });
      previousLogoUrl = current?.logo?.url;
    }

    updatedWorkspace = await prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data,
      select: selectWorkspace,
    });
  } catch (error) {
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }

  await runPostCommitProjection("workspace_update", () =>
    reconcileTeamWorkspaceRelationships({ workspaceIds: [workspaceId] })
  );

  // Compared against what was actually persisted, not against the input: Prisma treats
  // `logo: undefined` as "leave this field alone", so trusting the input would delete the object
  // while the row still points at it. Every upload gets a unique `--fid--{uuid}` key, so the old
  // object has exactly one referrer and losing it orphans the file.
  if (previousLogoUrl && previousLogoUrl !== updatedWorkspace.logo?.url) {
    await deleteOrphanedWorkspaceLogoFile(workspaceId, previousLogoUrl);
  }

  return updatedWorkspace as TWorkspace;
};

export const createWorkspace = async (
  organizationId: string,
  workspaceInput: TWorkspaceUpdateInput
): Promise<TWorkspace> => {
  validateInputs([organizationId, ZId], [workspaceInput, ZWorkspaceUpdateInput]);

  if (!workspaceInput.name) {
    throw new ValidationError("Workspace Name is required");
  }

  const { teamIds, config: configInput, ...data } = workspaceInput;
  // Captured out here so the guard above still narrows it: inside the transaction callback below,
  // TypeScript widens workspaceInput.name back to `string | undefined`.
  const name = workspaceInput.name;
  let workspace: TWorkspace;

  try {
    // The ownership check and both writes share one transaction: it keeps the check and the link
    // atomic (a team cannot leave the organization in between), and stops a failed createMany from
    // leaving an orphan workspace with no team links.
    workspace = (await prisma.$transaction(async (tx) => {
      // ENG-1922: teamIds are caller-supplied. Validate that every team belongs to this
      // organization before linking it — otherwise a caller could attach another org's team
      // to their workspace (a cross-tenant WorkspaceTeam write). The FK only enforces that the
      // team exists, not that it belongs here, so this must be checked at the app layer. A
      // foreign-but-real id and a nonexistent id fail identically, so this is not an
      // existence oracle for other orgs' teams.
      if (teamIds && teamIds.length > 0) {
        const uniqueTeamIds = new Set(teamIds);
        if (uniqueTeamIds.size !== teamIds.length) {
          throw new ValidationError("teamIds must be unique");
        }
        const teams = await tx.team.findMany({
          where: { id: { in: teamIds }, organizationId },
          select: { id: true },
        });
        if (teams.length !== uniqueTeamIds.size) {
          const foundTeamIds = new Set(teams.map((team) => team.id));
          const foreignTeamIds = [...uniqueTeamIds].filter((teamId) => !foundTeamIds.has(teamId));
          // ENG-1922: log the rejected cross-organization attempt for security observability.
          // Only tenant identifiers (org id + the caller-supplied team ids) are logged — no PII.
          logger.warn(
            { organizationId, foreignTeamIds },
            "Rejected cross-organization team assignment on workspace creation (ENG-1922)"
          );
          throw new ValidationError("teamIds must belong to the organization");
        }
      }

      const workspace = await tx.workspace.create({
        data: {
          ...data,
          // Built explicitly rather than spread from the caller: the default survey language has to be
          // one of the workspace's own languages, and a workspace being created has only the seeded
          // `DEFAULT_WORKSPACE_LANGUAGE`. It is configured afterwards from workspace settings, where
          // `updateWorkspaceAction` can validate it against the languages that exist (ENG-2816).
          config: {
            channel: configInput?.channel ?? null,
            industry: configInput?.industry ?? null,
          },
          name,
          organizationId,
          contactAttributeKeys: {
            create: DEFAULT_CONTACT_ATTRIBUTE_KEYS,
          },
          languages: {
            create: [DEFAULT_WORKSPACE_LANGUAGE],
          },
        },
        select: selectWorkspace,
      });

      if (teamIds) {
        await tx.workspaceTeam.createMany({
          data: teamIds.map((teamId) => ({
            workspaceId: workspace.id,
            teamId,
          })),
        });
      }

      return workspace;
    })) as TWorkspace;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new InvalidInputError("A workspace with this name already exists in your organization");
    }
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }

  await runPostCommitProjection("workspace_create", () =>
    reconcileTeamWorkspaceRelationships({
      workspaceIds: [workspace.id],
      workspaceTeamGrants: (teamIds ?? []).map((teamId) => ({ teamId, workspaceId: workspace.id })),
    })
  );

  return workspace;
};

type TWorkspaceDeletionDbClient = typeof prisma | Prisma.TransactionClient;

const deleteWorkspaceRecord = async (db: TWorkspaceDeletionDbClient, workspaceId: string) => {
  const feedbackDirectoryAssignments = await db.feedbackDirectoryWorkspace.findMany({
    where: { workspaceId },
    select: { feedbackDirectoryId: true, workspaceId: true },
  });
  const workspace = await db.workspace.delete({
    where: {
      id: workspaceId,
    },
    // legacyEnvironmentId rides along on the deleted row so storage cleanup has the legacy prefix
    // after the row is gone. It is not part of selectWorkspace because no other caller needs it.
    select: { ...selectWorkspace, legacyEnvironmentId: true },
  });

  return { feedbackDirectoryAssignments, workspace };
};

const completeWorkspaceDeletion = async (
  workspaceId: string,
  { feedbackDirectoryAssignments, workspace }: Awaited<ReturnType<typeof deleteWorkspaceRecord>>
) => {
  await runPostCommitProjection("workspace_delete", () =>
    reconcileTeamWorkspaceRelationships({ workspaceIds: [workspaceId] })
  );
  await runPostCommitProjection("workspace_delete_feedback_directory_cleanup", () =>
    reconcileFeedbackDirectoryRelationships({ assignments: feedbackDirectoryAssignments })
  );

  await deleteWorkspaceFilesBestEffort(workspace);

  return workspace;
};

const throwWorkspaceDeletionError = (error: unknown): never => {
  if (isPrismaKnownRequestError(error)) {
    throw new DatabaseError(error.message);
  }

  throw error;
};

export const deleteWorkspace = async (workspaceId: string): Promise<TWorkspace> => {
  try {
    return await completeWorkspaceDeletion(workspaceId, await deleteWorkspaceRecord(prisma, workspaceId));
  } catch (error) {
    return throwWorkspaceDeletionError(error);
  }
};

export const deleteWorkspaceIfNotLast = async (
  workspaceId: string,
  organizationId: string
): Promise<TWorkspace> => {
  try {
    const deletion = await prisma.$transaction(async (tx) => {
      // Lock every workspace in a stable order. Concurrent deletion requests for the organization
      // then serialize, so the second request sees the first deletion before evaluating the guard.
      const workspaces = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Workspace"
        WHERE "organizationId" = ${organizationId}
        ORDER BY "id"
        FOR UPDATE
      `;

      if (!workspaces.some((workspace) => workspace.id === workspaceId)) {
        throw new ResourceNotFoundError("workspace", workspaceId);
      }

      if (workspaces.length <= 1) {
        throw new OperationNotAllowedError("You can't delete the last workspace.");
      }

      return deleteWorkspaceRecord(tx, workspaceId);
    });

    return await completeWorkspaceDeletion(workspaceId, deletion);
  } catch (error) {
    return throwWorkspaceDeletionError(error);
  }
};
