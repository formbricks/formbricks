import { z } from "zod";
import { prisma } from "@formbricks/database";
import { StyleGuideCreate, StyleGuideUpdate } from "@formbricks/types/style-guide";

export const styleGuideService = {
  async create(data: StyleGuideCreate) {
    return prisma.styleGuide.create({
      data: {
        name: data.name,
        organizationId: data.organizationId,
        brandColor: data.brandColor,
        accentColor: data.accentColor,
        borderRadius: data.borderRadius,
        fontSize: data.fontSize,
        fontFamily: data.fontFamily,
        version: data.version,
        authors: data.authors,
        externalDocumentation: data.externalDocumentation,
        logo: data.logo,
        customColors: data.customColors,
      },
    });
  },

  async update(id: string, data: StyleGuideUpdate) {
    return prisma.styleGuide.update({
      where: { id },
      data: {
        name: data.name,
        brandColor: data.brandColor,
        accentColor: data.accentColor,
        borderRadius: data.borderRadius,
        fontSize: data.fontSize,
        fontFamily: data.fontFamily,
        version: data.version,
        authors: data.authors,
        externalDocumentation: data.externalDocumentation,
        logo: data.logo,
        customColors: data.customColors,
        workspaceConfig: data.workspaceConfig,
        isActive: data.isActive,
      },
    });
  },

  async findById(id: string) {
    return prisma.styleGuide.findUnique({
      where: { id },
    });
  },

  async findByOrganizationId(organizationId: string) {
    return prisma.styleGuide.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  },

  async delete(id: string) {
    return prisma.styleGuide.delete({
      where: { id },
    });
  },

  async enableForWorkspace(styleGuideId: string, workspaceId: string) {
    const styleGuide = await prisma.styleGuide.findUnique({
      where: { id: styleGuideId },
    });

    if (!styleGuide) {
      throw new Error("StyleGuide not found");
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
  },

  async disableForWorkspace(styleGuideId: string, workspaceId: string) {
    const styleGuide = await prisma.styleGuide.findUnique({
      where: { id: styleGuideId },
    });

    if (!styleGuide) {
      throw new Error("StyleGuide not found");
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
  },

  async setActiveForWorkspace(workspaceId: string, styleGuideId: string | null) {
    return prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        activeStyleGuideId: styleGuideId,
      },
    });
  },
};
