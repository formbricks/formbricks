"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { ZContactAttributeDataType, ZContactAttributeKeyType } from "@formbricks/types/contact-attribute-key";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";

// I need proper helpers for auth. usually checkAuthorizationUpdated wrapper handles project/environment checks via getters?
// Or I manually fetch.

const ZCreateAttributeKeyAction = z.object({
  environmentId: ZId,
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  type: ZContactAttributeKeyType.optional(), // custom usually
  dataType: ZContactAttributeDataType.optional(),
});

export const createAttributeKeyAction = authenticatedActionClient
  .schema(ZCreateAttributeKeyAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdByEnvironmentId(parsedInput.environmentId);
    if (!organizationId) throw new ResourceNotFoundError("Environment", parsedInput.environmentId);

    const projectId = await getProjectIdByEnvironmentId(parsedInput.environmentId);
    if (!projectId) throw new ResourceNotFoundError("Project", parsedInput.environmentId);

    // Auth check
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId,
        },
      ],
    });

    const existingKey = await prisma.contactAttributeKey.findFirst({
      where: {
        environmentId: parsedInput.environmentId,
        key: parsedInput.key,
      },
    });

    if (existingKey) {
      throw new Error("Attribute key already exists");
    }

    const attributeKey = await prisma.contactAttributeKey.create({
      data: {
        environmentId: parsedInput.environmentId,
        key: parsedInput.key,
        name: parsedInput.name,
        description: parsedInput.description,
        type: parsedInput.type ?? "custom",
        dataType: parsedInput.dataType ?? "text",
      },
    });

    return attributeKey;
  });

const ZUpdateAttributeKeyAction = z.object({
  id: ZId,
  environmentId: ZId,
  name: z.string().min(1),
  description: z.string().optional(),
  dataType: ZContactAttributeDataType.optional(), // allowing update?
});

export const updateAttributeKeyAction = authenticatedActionClient
  .schema(ZUpdateAttributeKeyAction)
  .action(async ({ ctx, parsedInput }) => {
    // Auth check
    const organizationId = await getOrganizationIdByEnvironmentId(parsedInput.environmentId);
    if (!organizationId) throw new ResourceNotFoundError("Organization", parsedInput.environmentId);

    const projectId = await getProjectIdByEnvironmentId(parsedInput.environmentId);
    if (!projectId) throw new ResourceNotFoundError("Project", parsedInput.environmentId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId,
        },
      ],
    });

    // check if data type update is safe?
    // For now trusting the user or UI to warn.

    const attributeKey = await prisma.contactAttributeKey.update({
      where: {
        id: parsedInput.id,
      },
      data: {
        name: parsedInput.name,
        description: parsedInput.description,
        dataType: parsedInput.dataType,
      },
    });

    return attributeKey;
  });

const ZDeleteAttributeKeyAction = z.object({
  id: ZId,
  environmentId: ZId,
});

export const deleteAttributeKeyAction = authenticatedActionClient
  .schema(ZDeleteAttributeKeyAction)
  .action(async ({ ctx, parsedInput }) => {
    // Auth check
    const organizationId = await getOrganizationIdByEnvironmentId(parsedInput.environmentId);
    if (!organizationId) throw new ResourceNotFoundError("Organization", parsedInput.environmentId);

    const projectId = await getProjectIdByEnvironmentId(parsedInput.environmentId);
    if (!projectId) throw new ResourceNotFoundError("Project", parsedInput.environmentId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId,
        },
      ],
    });

    await prisma.contactAttributeKey.delete({
      where: {
        id: parsedInput.id,
      },
    });

    return { success: true };
  });

// Helpers (mocked or should be imported from somewhere)
// I need `getOrganizationIdByEnvironmentId` and `getProjectIdByEnvironmentId`.
// Usually in `@/lib/project/service` or similar. I'll need to confirm imports.
// `getProjectIdByEnvironmentId` is usually available.
// `getOrganizationIdByEnvironmentId` - I might need to fetch environment then project then org.
// Or helper exists.
async function getOrganizationIdByEnvironmentId(environmentId: string) {
  const environment = await prisma.environment.findUnique({
    where: { id: environmentId },
    select: { project: { select: { organizationId: true } } },
  });
  return environment?.project.organizationId;
}

async function getProjectIdByEnvironmentId(environmentId: string) {
  const environment = await prisma.environment.findUnique({
    where: { id: environmentId },
    select: { projectId: true },
  });
  return environment?.projectId;
}
