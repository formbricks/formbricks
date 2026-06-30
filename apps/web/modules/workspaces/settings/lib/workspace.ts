import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ValidationError } from "@formbricks/types/errors";
import { TWorkspace, TWorkspaceUpdateInput, ZWorkspaceUpdateInput } from "@formbricks/types/workspace";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { isPrismaKnownRequestError, isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { validateInputs } from "@/lib/utils/validate";
import { deleteFilesByWorkspaceId } from "@/modules/storage/service";

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

export const updateWorkspace = async (
  workspaceId: string,
  inputWorkspace: TWorkspaceUpdateInput
): Promise<TWorkspace> => {
  validateInputs([workspaceId, ZId], [inputWorkspace, ZWorkspaceUpdateInput]);
  const { ...data } = inputWorkspace;
  let updatedWorkspace;
  try {
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

  const { teamIds, ...data } = workspaceInput;

  try {
    const workspace = await prisma.workspace.create({
      data: {
        config: {
          channel: null,
          industry: null,
        },
        ...data,
        name: workspaceInput.name,
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
      await prisma.workspaceTeam.createMany({
        data: teamIds.map((teamId) => ({
          workspaceId: workspace.id,
          teamId,
        })),
      });
    }

    return workspace;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new InvalidInputError("A workspace with this name already exists in your organization");
    }
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const deleteWorkspace = async (workspaceId: string): Promise<TWorkspace> => {
  try {
    const workspace = await prisma.workspace.delete({
      where: {
        id: workspaceId,
      },
      select: selectWorkspace,
    });

    if (workspace) {
      const s3Result = await deleteFilesByWorkspaceId(workspaceId, []);

      if (!s3Result.ok && "error" in s3Result) {
        // fail silently because we don't want to throw an error if the files are not deleted
        logger.error(s3Result.error, "Error deleting S3 files");
      }
    }

    return workspace;
  } catch (error) {
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
