import "server-only";
import { prisma } from "@formbricks/database";
import { getIsDashboardViewerRoleEnabled } from "@/modules/ee/license-check/lib/utils";
import { filterReadablePageIds } from "./spicedb-access";

/** The dashboard a private storage name `dashboards/<dashboardId>/<file>` belongs to, or `null`. */
export const getDashboardImageFileDashboardId = (fileName: string): string | null => {
  const parts = fileName.split("/");
  if (parts.length !== 3 || parts[0] !== "dashboards") return null;
  const [, dashboardId, file] = parts;
  if (!/^[a-z0-9]{1,64}$/.test(dashboardId) || file.length === 0) return null;
  return dashboardId;
};

/**
 * Whether `userId` may download a dashboard image upload (ENG-7482) without reading the workspace: a
 * Dashboard Viewer may, when an image block on a page they open (`dashboardPage.read`) shows exactly
 * this file. Only GET reaches this; a viewer never deletes. A lapsed plan (Access Control or Dashboards)
 * refuses, like every other Dashboard Viewer read.
 */
export const canReadDashboardImageFile = async (
  userId: string,
  workspaceId: string,
  fileName: string
): Promise<boolean> => {
  const dashboardId = getDashboardImageFileDashboardId(fileName);
  if (!dashboardId) return false;

  const fileUrl = `/storage/${workspaceId}/private/${fileName}`;
  const dashboard = await prisma.dashboard.findFirst({
    where: { id: dashboardId, workspaceId },
    select: {
      workspace: { select: { organizationId: true } },
      widgets: {
        where: { kind: "image", content: { path: ["fileUrl"], equals: fileUrl } },
        select: { pageId: true },
        take: 50,
      },
    },
  });
  if (!dashboard || dashboard.widgets.length === 0) return false;
  if (!(await getIsDashboardViewerRoleEnabled(dashboard.workspace.organizationId))) return false;

  const readable = await filterReadablePageIds(
    { type: "user", id: userId },
    dashboard.widgets.map(({ pageId }) => pageId)
  );
  return readable.size > 0;
};
