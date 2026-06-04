import { NextRequest } from "next/server";
import { prisma } from "@formbricks/database";
import { apiWrapper } from "@/app/api/v1/lib/utils";
import { getActiveStyleGuideForWorkspace } from "@/lib/style-guides/utils";

export const GET = apiWrapper(async (req: NextRequest, { params }: any) => {
  const { workspaceId } = params;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    return { error: "Workspace not found", status: 404 };
  }

  const styleGuide = await getActiveStyleGuideForWorkspace(workspaceId);

  return { data: styleGuide };
});
