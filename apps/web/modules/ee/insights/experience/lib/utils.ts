import { TStatsPeriod } from "@/modules/ee/insights/experience/types/stats";

export const getDateFromTimeRange = (timeRange: TStatsPeriod): Date | undefined => {
  if (timeRange === "all") {
    return new Date(0);
  }
  const now = new Date();
  switch (timeRange) {
    case "day":
      return new Date(now.getTime() - 1000 * 60 * 60 * 24);
    case "week":
      return new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7);
    case "month":
      return new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30);
    case "quarter":
      return new Date(now.getTime() - 1000 * 60 * 60 * 24 * 90);
  }
};
