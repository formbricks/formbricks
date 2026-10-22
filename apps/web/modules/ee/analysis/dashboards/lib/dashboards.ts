import "server-only";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { isPrismaKnownRequestError } from "@/lib/utils/prisma-error";
import { validateInputs } from "@/lib/utils/validate";
import { TDashboardWithCount } from "@/modules/ee/analysis/types/analysis";

const selectDashboard = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
} as const;

export const getDashboards = async (
  workspaceId: string,
  chartId?: string
): Promise<TDashboardWithCount[]> => {
  validateInputs([workspaceId, ZId], [chartId, ZId.optional()]);

  try {
    const select = {
      ...selectDashboard,
      creator: { select: { name: true } },
      _count: { select: { widgets: true } },
      ...(chartId ? { widgets: { where: { chartId }, select: { id: true }, take: 1 } } : {}),
    };

    const dashboards = await prisma.dashboard.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select,
    });

    if (!chartId) {
      return dashboards;
    }

    return dashboards.map(({ widgets, ...rest }) => ({
      ...rest,
      containsChart: (widgets?.length ?? 0) > 0,
    }));
  } catch (error) {
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
