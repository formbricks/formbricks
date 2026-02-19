import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TChartUpdateInput } from "@/modules/api/v2/management/charts/[chartId]/types/charts";
import { deleteChart, getChart, updateChart } from "../chart";
import { mockedChart, prismaNotFoundError, prismaUniqueConstraintError } from "./mocks/chart.mock";

vi.mock("@formbricks/database", () => ({
  prisma: {
    chart: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe("getChart", () => {
  test("returns ok if chart is found", async () => {
    vi.mocked(prisma.chart.findUnique).mockResolvedValueOnce(mockedChart);
    const result = await getChart("chart123");
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data).toEqual(mockedChart);
    }
  });

  test("returns err if chart not found", async () => {
    vi.mocked(prisma.chart.findUnique).mockResolvedValueOnce(null);
    const result = await getChart("nonexistent");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toBe("not_found");
    }
  });

  test("returns err on Prisma error", async () => {
    vi.mocked(prisma.chart.findUnique).mockRejectedValueOnce(new Error("DB error"));
    const result = await getChart("error");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.type).toBe("internal_server_error");
    }
  });
});

describe("updateChart", () => {
  const updateInput: TChartUpdateInput = { name: "Updated Chart" };

  test("returns ok on successful update", async () => {
    const updatedChart = { ...mockedChart, name: "Updated Chart" };
    vi.mocked(prisma.chart.update).mockResolvedValueOnce(updatedChart);
    const result = await updateChart("chart123", updateInput);
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.name).toBe("Updated Chart");
    }
  });

  test("returns not_found if record does not exist", async () => {
    vi.mocked(prisma.chart.update).mockRejectedValueOnce(prismaNotFoundError);
    const result = await updateChart("nonexistent", updateInput);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toBe("not_found");
    }
  });

  test("returns conflict on duplicate name", async () => {
    vi.mocked(prisma.chart.update).mockRejectedValueOnce(prismaUniqueConstraintError);
    const result = await updateChart("chart123", updateInput);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toBe("conflict");
    }
  });

  test("returns internal_server_error on other errors", async () => {
    vi.mocked(prisma.chart.update).mockRejectedValueOnce(new Error("Unknown error"));
    const result = await updateChart("chart123", updateInput);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toBe("internal_server_error");
    }
  });
});

describe("deleteChart", () => {
  test("returns ok on successful delete", async () => {
    vi.mocked(prisma.chart.delete).mockResolvedValueOnce(mockedChart);
    const result = await deleteChart("chart123");
    expect(result.ok).toBe(true);
  });

  test("returns not_found if record does not exist", async () => {
    vi.mocked(prisma.chart.delete).mockRejectedValueOnce(prismaNotFoundError);
    const result = await deleteChart("nonexistent");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toBe("not_found");
    }
  });

  test("returns internal_server_error on other errors", async () => {
    vi.mocked(prisma.chart.delete).mockRejectedValueOnce(new Error("Delete error"));
    const result = await deleteChart("error");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error?.type).toBe("internal_server_error");
    }
  });
});
