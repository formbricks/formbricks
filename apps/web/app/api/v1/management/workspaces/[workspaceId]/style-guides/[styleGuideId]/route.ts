import { NextRequest } from "next/server";
import { prisma } from "@formbricks/database";
import { apiWrapper } from "@/app/api/v1/lib/utils";

export const POST = apiWrapper(async (req: NextRequest, { params }: any) => {
  const { workspaceId, styleGuideId } = params;
  const { action } = await req.json();

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    return { error: "Workspace not found", status: 404 };
  }

  const styleGuide = await prisma.styleGuide.findUnique({
    where: { id: styleGuideId },
  });

  if (!styleGuide) {
    return { error: "Style guide not found", status: 404 };
  }

  const workspaceConfig =
    typeof styleGuide.workspaceConfig === "string"
      ? JSON.parse(styleGuide.workspaceConfig)
      : styleGuide.workspaceConfig || {};

  if (action === "enable") {
    const updated = await prisma.styleGuide.update({
      where: { id: styleGuideId },
      data: {
        workspaceConfig: {
          ...workspaceConfig,
          [workspaceId]: true,
        },
      },
    });
    return { data: updated };
  } else if (action === "disable") {
    const updated = await prisma.styleGuide.update({
      where: { id: styleGuideId },
      data: {
        workspaceConfig: {
          ...workspaceConfig,
          [workspaceId]: false,
        },
      },
    });
    return { data: updated };
  } else if (action === "activate") {
    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { activeStyleGuideId: styleGuideId },
    });
    return { data: updated };
  } else if (action === "deactivate") {
    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { activeStyleGuideId: null },
    });
    return { data: updated };
  }

  return { error: "Invalid action", status: 400 };
});
