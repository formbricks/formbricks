import "server-only";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { TChartConfig, TChartQuery } from "@formbricks/types/dashboard";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { TChartType } from "../../types/analysis";

export const selectChart = {
  id: true,
  name: true,
  type: true,
  query: true,
  config: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const createChart = async (data: {
  projectId: string;
  name: string;
  type: TChartType;
  query: TChartQuery;
  config: TChartConfig;
  createdBy: string;
}) => {
  validateInputs([data.projectId, ZId], [data.createdBy, ZId]);

  return prisma.chart.create({
    data: {
      name: data.name,
      type: data.type,
      projectId: data.projectId,
      query: data.query,
      config: data.config,
      createdBy: data.createdBy,
    },
  });
};

export const updateChart = async (
  chartId: string,
  projectId: string,
  data: {
    name?: string;
    type?: TChartType;
    query?: TChartQuery;
    config?: TChartConfig;
  }
) => {
  validateInputs([chartId, ZId], [projectId, ZId]);

  return prisma.$transaction(async (tx) => {
    const chart = await tx.chart.findFirst({
      where: { id: chartId, projectId },
    });

    if (!chart) {
      throw new ResourceNotFoundError("Chart", chartId);
    }

    const updatedChart = await tx.chart.update({
      where: { id: chartId },
      data: {
        name: data.name,
        type: data.type,
        query: data.query,
        config: data.config,
      },
    });

    return { chart, updatedChart };
  });
};

const getUniqueCopyName = async (baseName: string, projectId: string): Promise<string> => {
  const stripped = baseName.replace(/ \(copy(?: \d+)?\)$/, "");

  const existing = await prisma.chart.findMany({
    where: {
      projectId,
      name: { startsWith: `${stripped} (copy` },
    },
    select: { name: true },
  });

  const existingNames = new Set(existing.map((c) => c.name));

  const firstCandidate = `${stripped} (copy)`;
  if (!existingNames.has(firstCandidate)) {
    return firstCandidate;
  }

  let n = 2;
  while (existingNames.has(`${stripped} (copy ${n})`)) {
    n++;
  }
  return `${stripped} (copy ${n})`;
};

export const duplicateChart = async (chartId: string, projectId: string, createdBy: string) => {
  validateInputs([chartId, ZId], [projectId, ZId], [createdBy, ZId]);

  const sourceChart = await prisma.chart.findFirst({
    where: { id: chartId, projectId },
  });

  if (!sourceChart) {
    throw new ResourceNotFoundError("Chart", chartId);
  }

  const uniqueName = await getUniqueCopyName(sourceChart.name, projectId);

  return createChart({
    projectId,
    name: uniqueName,
    type: sourceChart.type as TChartType,
    query: sourceChart.query as TChartQuery,
    config: (sourceChart.config as TChartConfig) ?? {},
    createdBy,
  });
};

export const deleteChart = async (chartId: string, projectId: string) => {
  validateInputs([chartId, ZId], [projectId, ZId]);

  return prisma.$transaction(async (tx) => {
    const chart = await tx.chart.findFirst({
      where: { id: chartId, projectId },
    });

    if (!chart) {
      throw new ResourceNotFoundError("Chart", chartId);
    }

    await tx.chart.delete({
      where: { id: chartId },
    });

    return chart;
  });
};

export const getChart = async (chartId: string, projectId: string) => {
  validateInputs([chartId, ZId], [projectId, ZId]);

  const chart = await prisma.chart.findFirst({
    where: { id: chartId, projectId },
    select: selectChart,
  });

  if (!chart) {
    throw new ResourceNotFoundError("Chart", chartId);
  }

  return chart;
};

export const getCharts = async (projectId: string) => {
  validateInputs([projectId, ZId]);

  return prisma.chart.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      ...selectChart,
      widgets: {
        select: { dashboardId: true },
      },
    },
  });
};
