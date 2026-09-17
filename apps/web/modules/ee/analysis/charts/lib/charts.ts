import "server-only";
import { prisma } from "@formbricks/database";
import { ZChartConfig, ZChartQuery } from "@formbricks/types/analysis";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { isPrismaKnownRequestError, isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { validateInputs } from "@/lib/utils/validate";
import { validateCubeQueryMembers } from "@/modules/ee/analysis/api/lib/cube-query";
import {
  TChart,
  TChartCreateInput,
  TChartUpdateInput,
  TChartWithCreator,
  ZChartCreateInput,
  ZChartUpdateInput,
} from "@/modules/ee/analysis/types/analysis";
import { normalizeBridgeChart } from "./bridge-chart";

export const selectChart = {
  id: true,
  name: true,
  type: true,
  query: true,
  config: true,
  feedbackDirectoryId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const createChart = async (data: TChartCreateInput): Promise<TChart> => {
  validateInputs([data, ZChartCreateInput]);
  validateCubeQueryMembers(data.query);

  try {
    const chart = await prisma.chart.create({
      data: {
        name: data.name,
        type: data.type,
        workspaceId: data.workspaceId,
        query: data.query,
        config: data.config,
        createdBy: data.createdBy,
        feedbackDirectoryId: data.feedbackDirectoryId,
      },
      select: selectChart,
    });
    return normalizeBridgeChart(chart);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new InvalidInputError("A chart with this name already exists");
    }
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateChart = async (
  chartId: string,
  workspaceId: string,
  data: TChartUpdateInput
): Promise<{ chart: TChart; updatedChart: TChart }> => {
  validateInputs([chartId, ZId], [workspaceId, ZId], [data, ZChartUpdateInput]);
  if (data.query) {
    validateCubeQueryMembers(data.query);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const chart = await tx.chart.findFirst({
        where: { id: chartId, workspaceId },
        select: selectChart,
      });

      if (!chart) {
        throw new ResourceNotFoundError("Chart", chartId);
      }

      const normalizedChart = normalizeBridgeChart(chart);

      const updatedChart = await tx.chart.update({
        where: { id: chartId },
        data: {
          name: data.name,
          type: data.type ?? (chart.type === "line" ? normalizedChart.type : undefined),
          query: data.query,
          config: data.config ?? (chart.type === "line" ? normalizedChart.config : undefined),
        },
        select: selectChart,
      });

      return { chart: normalizedChart, updatedChart: normalizeBridgeChart(updatedChart) };
    });
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      throw error;
    }
    if (isUniqueConstraintError(error)) {
      throw new InvalidInputError("A chart with this name already exists");
    }
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

const getUniqueCopyName = async (baseName: string, workspaceId: string): Promise<string> => {
  const stripped = baseName.replace(/ \(copy(?: \d+)?\)$/, "");

  try {
    const existing = await prisma.chart.findMany({
      where: {
        workspaceId,
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
  } catch (error) {
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const duplicateChart = async (
  chartId: string,
  workspaceId: string,
  createdBy: string
): Promise<TChart> => {
  validateInputs([chartId, ZId], [workspaceId, ZId], [createdBy, ZId]);

  try {
    const sourceChart = await prisma.chart.findFirst({
      where: { id: chartId, workspaceId },
      select: selectChart,
    });

    if (!sourceChart) {
      throw new ResourceNotFoundError("Chart", chartId);
    }

    const uniqueName = await getUniqueCopyName(sourceChart.name, workspaceId);
    const normalizedChart = normalizeBridgeChart(sourceChart);

    return await createChart({
      workspaceId,
      name: uniqueName,
      type: normalizedChart.type,
      query: ZChartQuery.parse(sourceChart.query),
      config: ZChartConfig.parse(normalizedChart.config ?? {}),
      feedbackDirectoryId: sourceChart.feedbackDirectoryId,
      createdBy,
    });
  } catch (error) {
    if (error instanceof ResourceNotFoundError || error instanceof InvalidInputError) {
      throw error;
    }
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const deleteChart = async (chartId: string, workspaceId: string): Promise<TChart> => {
  validateInputs([chartId, ZId], [workspaceId, ZId]);

  try {
    return await prisma.$transaction(async (tx) => {
      const chart = await tx.chart.findFirst({
        where: { id: chartId, workspaceId },
        select: selectChart,
      });

      if (!chart) {
        throw new ResourceNotFoundError("Chart", chartId);
      }

      await tx.chart.delete({
        where: { id: chartId },
      });

      return normalizeBridgeChart(chart);
    });
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      throw error;
    }
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getChart = async (chartId: string, workspaceId: string): Promise<TChart> => {
  validateInputs([chartId, ZId], [workspaceId, ZId]);

  try {
    const chart = await prisma.chart.findFirst({
      where: { id: chartId, workspaceId },
      select: selectChart,
    });

    if (!chart) {
      throw new ResourceNotFoundError("Chart", chartId);
    }

    return normalizeBridgeChart(chart);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      throw error;
    }
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getCharts = async (workspaceId: string): Promise<TChartWithCreator[]> => {
  validateInputs([workspaceId, ZId]);

  try {
    const charts = await prisma.chart.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        ...selectChart,
        creator: { select: { name: true } },
      },
    });
    return charts.map(normalizeBridgeChart);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      throw error;
    }
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getChartsWithCreator = async (workspaceId: string): Promise<TChartWithCreator[]> => {
  validateInputs([workspaceId, ZId]);

  try {
    const charts = await prisma.chart.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        ...selectChart,
        creator: {
          select: { name: true },
        },
      },
    });
    return charts.map(normalizeBridgeChart);
  } catch (error) {
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
