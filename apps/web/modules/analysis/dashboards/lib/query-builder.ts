/**
 * Query builder utility to construct Cube.js queries from chart builder state.
 */
import { TCubeFilter, TCubeQuery, TTimeDimension } from "../types/analysis";

export interface CustomMeasure {
  field: string;
  aggregation: string;
  alias?: string;
}

export interface FilterRow {
  field: string;
  operator: TCubeFilter["operator"];
  values: string[] | number[] | null;
}

export interface TimeDimensionConfig {
  dimension: string;
  granularity: "hour" | "day" | "week" | "month" | "quarter" | "year";
  dateRange: string | [Date, Date];
}

export interface ChartBuilderState {
  chartType: string;
  selectedMeasures: string[];
  customMeasures: CustomMeasure[];
  selectedDimensions: string[];
  filters: FilterRow[];
  filterLogic: "and" | "or";
  timeDimension: TimeDimensionConfig | null;
  limit?: number;
  orderBy?: { field: string; direction: "asc" | "desc" };
}

/**
 * Build a Cube.js query from chart builder state.
 */
export function buildCubeQuery(config: ChartBuilderState): TCubeQuery {
  const query: TCubeQuery = {
    measures: [...config.selectedMeasures],
  };

  if (config.selectedDimensions.length > 0) {
    query.dimensions = config.selectedDimensions;
  }

  if (config.timeDimension) {
    const timeDim: TTimeDimension = {
      dimension: config.timeDimension.dimension,
      granularity: config.timeDimension.granularity,
    };

    if (typeof config.timeDimension.dateRange === "string") {
      timeDim.dateRange = config.timeDimension.dateRange;
    } else if (Array.isArray(config.timeDimension.dateRange)) {
      const [startDate, endDate] = config.timeDimension.dateRange;
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };
      timeDim.dateRange = [formatDate(startDate), formatDate(endDate)];
    }

    query.timeDimensions = [timeDim];
  }

  if (config.filters.length > 0) {
    query.filters = config.filters.map((f) => {
      const filter: TCubeFilter = {
        member: f.field,
        operator: f.operator,
      };

      if (f.operator !== "set" && f.operator !== "notSet" && f.values) {
        filter.values = f.values.map((v) => String(v));
      }

      return filter;
    });
  }

  return query;
}

/**
 * Parse a Cube.js query back into ChartBuilderState.
 */
export function parseQueryToState(query: TCubeQuery, chartType?: string): Partial<ChartBuilderState> {
  const state: Partial<ChartBuilderState> = {
    chartType: chartType || "",
    selectedMeasures: query.measures || [],
    customMeasures: [],
    selectedDimensions: query.dimensions || [],
    filters: [],
    filterLogic: "and",
    timeDimension: null,
  };

  if (query.filters && query.filters.length > 0) {
    state.filters = query.filters.map((f) => ({
      field: f.member,
      operator: f.operator,
      values: f.values || null,
    }));
  }

  if (query.timeDimensions && query.timeDimensions.length > 0) {
    const timeDim = query.timeDimensions[0];
    state.timeDimension = {
      dimension: timeDim.dimension,
      granularity: (timeDim.granularity || "day") as TimeDimensionConfig["granularity"],
      dateRange: (timeDim.dateRange || "last 30 days") as TimeDimensionConfig["dateRange"],
    };
  }

  return state;
}

/**
 * Convert date preset string to date range.
 */
export function getDateRangeFromPreset(preset: string): [Date, Date] | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today": {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return [today, tomorrow];
    }
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return [yesterday, today];
    }
    case "last 7 days": {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return [sevenDaysAgo, today];
    }
    case "last 30 days": {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return [thirtyDaysAgo, today];
    }
    case "this month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return [firstDay, lastDay];
    }
    case "last month": {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return [firstDayLastMonth, firstDayThisMonth];
    }
    case "this quarter": {
      const quarter = Math.floor(now.getMonth() / 3);
      const firstDay = new Date(now.getFullYear(), quarter * 3, 1);
      const lastDay = new Date(now.getFullYear(), (quarter + 1) * 3, 1);
      return [firstDay, lastDay];
    }
    case "this year": {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      const lastDay = new Date(now.getFullYear() + 1, 0, 1);
      return [firstDay, lastDay];
    }
    default:
      return null;
  }
}
