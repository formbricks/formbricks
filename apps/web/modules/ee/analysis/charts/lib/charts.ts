import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId } from "@formbricks/types/common";
import { ZChartConfig, ZChartQuery } from "@formbricks/types/dashboard";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import {
  TChart,
  TChartCreateInput,
  TChartUpdateInput,
  TChartWithWidgets,
  ZChartCreateInput,
  ZChartType,
  ZChartUpdateInput,
} from "../../types/analysis";

export const selectChart = {
  id: true,
  name: true,
  type: true,
  query: true,
  config: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const createChart = async (data: TChartCreateInput): Promise<TChart> => {
  validateInputs([data, ZChartCreateInput]);

  try {
    return await prisma.chart.create({
      data: {
        name: data.name,
        type: data.type,
        projectId: data.projectId,
        query: data.query,
        config: data.config,
        createdBy: data.createdBy,
      },
      select: selectChart,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new InvalidInputError("A chart with this name already exists");
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateChart = async (
  chartId: string,
  projectId: string,
  data: TChartUpdateInput
): Promise<{ chart: TChart; updatedChart: TChart }> => {
  validateInputs([chartId, ZId], [projectId, ZId], [data, ZChartUpdateInput]);

  try {
    return await prisma.$transaction(async (tx) => {
      const chart = await tx.chart.findFirst({
        where: { id: chartId, projectId },
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
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new InvalidInputError("A chart with this name already exists");
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

const getUniqueCopyName = async (baseName: string, projectId: string): Promise<string> => {
  const stripped = baseName.replace(/ \(copy(?: \d+)?\)$/, "");

  try {
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const duplicateChart = async (
  chartId: string,
  projectId: string,
  createdBy: string
): Promise<TChart> => {
  validateInputs([chartId, ZId], [projectId, ZId], [createdBy, ZId]);

  try {
    const sourceChart = await prisma.chart.findFirst({
      where: { id: chartId, projectId },
      select: selectChart,
    });

    if (!sourceChart) {
      throw new ResourceNotFoundError("Chart", chartId);
    }

    const uniqueName = await getUniqueCopyName(sourceChart.name, projectId);

    return await createChart({
      projectId,
      name: uniqueName,
      type: ZChartType.parse(sourceChart.type),
      query: ZChartQuery.parse(sourceChart.query),
      config: ZChartConfig.parse(sourceChart.config ?? {}),
      createdBy,
    });
  } catch (error) {
    if (error instanceof ResourceNotFoundError || error instanceof InvalidInputError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const deleteChart = async (chartId: string, projectId: string): Promise<TChart> => {
  validateInputs([chartId, ZId], [projectId, ZId]);

  try {
    return await prisma.$transaction(async (tx) => {
      const chart = await tx.chart.findFirst({
        where: { id: chartId, projectId },
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
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getChart = async (chartId: string, projectId: string): Promise<TChart> => {
  validateInputs([chartId, ZId], [projectId, ZId]);

  try {
    const chart = await prisma.chart.findFirst({
      where: { id: chartId, projectId },
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
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getCharts = async (projectId: string): Promise<TChartWithWidgets[]> => {
  validateInputs([projectId, ZId]);

  try {
    return await prisma.chart.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        ...selectChart,
        widgets: {
          select: { dashboardId: true },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
