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

/** Image blocks read per round when authorizing a download, and the most rounds per request. */
const IMAGE_REFERENCE_BATCH = 100;
export const IMAGE_REFERENCE_MAX_ROUNDS = 20;

/**
 * Whether `userId` may download a dashboard image upload (ENG-7482) without reading the workspace: a
 * Dashboard Viewer may, when an image block on a page they open (`dashboardPage.read`), on any dashboard
 * of the workspace, shows exactly this file. Only GET reaches this; a viewer never deletes. A lapsed plan (Access Control or Dashboards)
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
  // Any image block of this workspace showing exactly this file counts, not only blocks on the dashboard
  // that uploaded it: a duplicated dashboard, or an API/MCP save, may show another dashboard's upload,
  // and widget writes accept any dashboard upload of the workspace (`isDashboardImageUrl`).
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { organizationId: true },
  });
  if (!workspace) return false;
  if (!(await getIsDashboardViewerRoleEnabled(workspace.organizationId))) return false;

  // Every block showing the file is a way in, so the references are paged (in id order) until one is on a
  // readable page. The ceiling bounds one request; a file shown on more pages than that is refused past it.
  let afterId: string | undefined;
  for (let round = 0; round < IMAGE_REFERENCE_MAX_ROUNDS; round++) {
    const widgets = await prisma.dashboardWidget.findMany({
      where: {
        kind: "image",
        content: { path: ["fileUrl"], equals: fileUrl },
        dashboard: { workspaceId },
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      select: { id: true, pageId: true },
      orderBy: { id: "asc" },
      take: IMAGE_REFERENCE_BATCH,
    });
    if (widgets.length === 0) return false;
    const readable = await filterReadablePageIds(
      { type: "user", id: userId },
      widgets.map(({ pageId }) => pageId)
    );
    if (readable.size > 0) return true;
    if (widgets.length < IMAGE_REFERENCE_BATCH) return false;
    afterId = widgets.at(-1)?.id;
  }
  return false;
};
