import "server-only";
import { prisma } from "@formbricks/database";
import { lookupReadableDashboardIds } from "@/lib/authorization/resource-list";
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

/** Readable dashboards per database round, and image-showing pages confirmed in SpiceDB per round. */
export const READABLE_DASHBOARD_CHUNK = 500;
const CANDIDATE_PAGE_BATCH = 100;

/**
 * Whether `userId` may download a dashboard image upload (ENG-7482) without reading the workspace: a
 * Dashboard Viewer may, when an image block on a page they open (`dashboardPage.read`), on any dashboard
 * of the workspace, shows exactly this file. Only GET reaches this (and only for a user who does not read
 * the workspace); a viewer never deletes. A lapsed plan (Access Control or Dashboards) refuses, like every
 * other Dashboard Viewer read.
 *
 * The lookup runs from the viewer's side, so no number of references on pages they cannot open crowds
 * out one they can: the dashboards they read come from one SpiceDB lookup (the one the dashboard list
 * uses), the database keeps only the pages of those dashboards that show the file and are open to the
 * viewer's teams, and SpiceDB confirms those pages. The work follows the dashboards the viewer reads,
 * not how often the file is referenced. A page the database admits but SpiceDB has not caught up on is
 * refused (fail closed).
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

  const subject = { type: "user", id: userId } as const;
  const readableDashboardIds = await lookupReadableDashboardIds(subject);

  for (let start = 0; start < readableDashboardIds.length; start += READABLE_DASHBOARD_CHUNK) {
    const dashboardIds = readableDashboardIds.slice(start, start + READABLE_DASHBOARD_CHUNK);
    // Pages of readable dashboards showing the file that are open to the viewer: unlimited (no flag and
    // no limit row, as the projection decides), or limited to a team they belong to. Only narrows what
    // SpiceDB is asked; SpiceDB still decides.
    const widgets = await prisma.dashboardWidget.findMany({
      where: {
        kind: "image",
        content: { path: ["fileUrl"], equals: fileUrl },
        dashboardId: { in: dashboardIds },
        dashboard: { workspaceId },
        page: {
          OR: [
            { teamLimited: false, teamLimits: { none: {} } },
            { teamLimits: { some: { team: { teamUsers: { some: { userId } } } } } },
          ],
        },
      },
      select: { pageId: true },
      distinct: ["pageId"],
      orderBy: { pageId: "asc" },
      take: CANDIDATE_PAGE_BATCH,
    });
    if (widgets.length === 0) continue;
    const readable = await filterReadablePageIds(
      subject,
      widgets.map(({ pageId }) => pageId)
    );
    if (readable.size > 0) return true;
  }
  return false;
};
