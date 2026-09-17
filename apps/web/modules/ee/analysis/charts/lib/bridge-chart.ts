import "server-only";
import type { TChartConfig } from "@formbricks/types/analysis";
import { type TChartType, ZChartType } from "@/modules/ee/analysis/types/analysis";

// Disposable rc.5 bridge only: read the old enum while original v5 pods drain. Match the
// canonical chart migration without changing its SQL or allowing new writes of `line`.
export const normalizeBridgeChart = <T extends { type: string; config: TChartConfig }>(
  chart: T
): Omit<T, "type"> & { type: TChartType } => {
  if (chart.type !== "line") return { ...chart, type: ZChartType.parse(chart.type) };
  const config =
    chart.config !== null && typeof chart.config === "object" && !Array.isArray(chart.config)
      ? chart.config
      : {};
  return { ...chart, type: "area", config: { ...config, areaDisplay: "line" } };
};
