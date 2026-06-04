"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZStyleGuideCreate, ZStyleGuideUpdate } from "@formbricks/types/style-guide";
import { authenticate } from "@/app/lib/auth";
import { hasUserOrganizationRole } from "@/app/lib/organization";
import { hasUserWorkspaceRole } from "@/app/lib/workspace";

export async function createStyleGuideAction(
  organizationId: string,
  data: z.infer<typeof ZStyleGuideCreate>
) {
  const session = await authenticate();

  if (!session || !session.user?.id) {
    throw new Error("Unauthorized");
  }

  const hasAccess = await hasUserOrganizationRole(session.user.id, organizationId, "owner");
  if (!hasAccess) {
    throw new Error("You do not have permission to create style guides for this organization");
  }

  const parsedData = ZStyleGuideCreate.parse({
    ...data,
    organizationId,
  });

  return prisma.styleGuide.create({
    data: parsedData,
  });
}

export async function updateStyleGuideAction(styleGuideId: string, data: z.infer<typeof ZStyleGuideUpdate>) {
  const session = await authenticate();

  if (!session || !session.user?.id) {
    throw new Error("Unauthorized");
  }

  const styleGuide = await prisma.styleGuide.findUnique({
    where: { id: styleGuideId },
  });

  if (!styleGuide) {
    throw new Error("Style guide not found");
  }

  const hasAccess = await hasUserOrganizationRole(session.user.id, styleGuide.organizationId, "owner");
  if (!hasAccess) {
    throw new Error("You do not have permission to update this style guide");
  }

  const parsedData = ZStyleGuideUpdate.parse(data);

  return prisma.styleGuide.update({
    where: { id: styleGuideId },
    data: parsedData,
  });
}

export async function deleteStyleGuideAction(styleGuideId: string) {
  const session = await authenticate();

  if (!session || !session.user?.id) {
    throw new Error("Unauthorized");
  }

  const styleGuide = await prisma.styleGuide.findUnique({
    where: { id: styleGuideId },
  });

  if (!styleGuide) {
    throw new Error("Style guide not found");
  }

  const hasAccess = await hasUserOrganizationRole(session.user.id, styleGuide.organizationId, "owner");
  if (!hasAccess) {
    throw new Error("You do not have permission to delete this style guide");
  }

  return prisma.styleGuide.delete({
    where: { id: styleGuideId },
  });
}

export async function getStyleGuidesAction(organizationId: string) {
  const session = await authenticate();

  if (!session || !session.user?.id) {
    throw new Error("Unauthorized");
  }

  const hasAccess = await hasUserOrganizationRole(session.user.id, organizationId, "member");
  if (!hasAccess) {
    throw new Error("You do not have permission to view style guides for this organization");
  }

  return prisma.styleGuide.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function enableStyleGuideForWorkspaceAction(styleGuideId: string, workspaceId: string) {
  const session = await authenticate();

  if (!session || !session.user?.id) {
    throw new Error("Unauthorized");
  }

  const styleGuide = await prisma.styleGuide.findUnique({
    where: { id: styleGuideId },
  });

  if (!styleGuide) {
    throw new Error("Style guide not found");
  }

  const hasOrgAccess = await hasUserOrganizationRole(session.user.id, styleGuide.organizationId, "owner");
  const hasWorkspaceAccess = await hasUserWorkspaceRole(session.user.id, workspaceId, "owner");

  if (!hasOrgAccess && !hasWorkspaceAccess) {
    throw new Error("You do not have permission to enable this style guide");
  }

  const workspaceConfig =
    typeof styleGuide.workspaceConfig === "string"
      ? JSON.parse(styleGuide.workspaceConfig)
      : styleGuide.workspaceConfig;

  return prisma.styleGuide.update({
    where: { id: styleGuideId },
    data: {
      workspaceConfig: {
        ...workspaceConfig,
        [workspaceId]: true,
      },
    },
  });
}

export async function disableStyleGuideForWorkspaceAction(styleGuideId: string, workspaceId: string) {
  const session = await authenticate();

  if (!session || !session.user?.id) {
    throw new Error("Unauthorized");
  }

  const styleGuide = await prisma.styleGuide.findUnique({
    where: { id: styleGuideId },
  });

  if (!styleGuide) {
    throw new Error("Style guide not found");
  }

  const hasOrgAccess = await hasUserOrganizationRole(session.user.id, styleGuide.organizationId, "owner");
  const hasWorkspaceAccess = await hasUserWorkspaceRole(session.user.id, workspaceId, "owner");

  if (!hasOrgAccess && !hasWorkspaceAccess) {
    throw new Error("You do not have permission to disable this style guide");
  }

  const workspaceConfig =
    typeof styleGuide.workspaceConfig === "string"
      ? JSON.parse(styleGuide.workspaceConfig)
      : styleGuide.workspaceConfig;

  return prisma.styleGuide.update({
    where: { id: styleGuideId },
    data: {
      workspaceConfig: {
        ...workspaceConfig,
        [workspaceId]: false,
      },
    },
  });
}

export async function setActiveStyleGuideForWorkspaceAction(
  workspaceId: string,
  styleGuideId: string | null
) {
  const session = await authenticate();

  if (!session || !session.user?.id) {
    throw new Error("Unauthorized");
  }

  const hasAccess = await hasUserWorkspaceRole(session.user.id, workspaceId, "owner");
  if (!hasAccess) {
    throw new Error("You do not have permission to set style guide for this workspace");
  }

  return prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      activeStyleGuideId: styleGuideId,
    },
  });
}
