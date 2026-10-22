import "server-only";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { assertNewReleaseWorkEnabled } from "@/lib/upgrade/compatibility";
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
  if (data.type === "matrix") await assertNewReleaseWorkEnabled();

  try {
    return await prisma.chart.create({
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
  if (data.type === "matrix") await assertNewReleaseWorkEnabled();
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

      const updatedChart = await tx.chart.update({
        where: { id: chartId },
        data: {
          name: data.name,
          type: data.type,
          query: data.query,
          config: data.config,
        },
        select: selectChart,
      });

      return { chart, updatedChart };
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

      return chart;
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

    return chart;
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
    return charts;
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
