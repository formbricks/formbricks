/**
 * Query builder utility to construct Cube.js queries from chart builder state.
 */
import { TChartQuery, TCubeFilter, TMemberFilter, TTimeDimension } from "@formbricks/types/analysis";

export interface CustomMeasure {
  id?: string;
  field: string;
  aggregation: string;
  alias?: string;
}

export type TFilterFieldType = "string" | "number" | "time";

export interface FilterRow {
  field: string;
  operator: TMemberFilter["operator"];
  values: string[] | number[] | null;
}

export interface TimeDimensionConfig {
  dimension: string;
  granularity?: "second" | "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year";
  dateRange?: string | [Date, Date];
}

export interface ChartBuilderState {
  selectedMeasures: string[];
  customMeasures: CustomMeasure[];
  selectedDimensions: string[];
  filters: FilterRow[];
  filterLogic: "and" | "or";
  timeDimension: TimeDimensionConfig | null;
  limit?: number;
  orderBy?: { field: string; direction: "asc" | "desc" };
}

function buildMemberFilter(f: FilterRow): TMemberFilter {
  const filter: TMemberFilter = {
    member: f.field,
    operator: f.operator,
  };
  if (f.operator !== "set" && f.operator !== "notSet" && f.values) {
    filter.values = f.values.map(String);
  }
  return filter;
}

/**
 * Build a Cube.js query from chart builder state.
 */
export function buildCubeQuery(config: ChartBuilderState): TChartQuery {
  const query: TChartQuery = {
    measures: [...config.selectedMeasures],
  };

  if (config.selectedDimensions.length > 0) {
    query.dimensions = config.selectedDimensions;
  }

  if (config.timeDimension) {
    const timeDim: TTimeDimension = {
      dimension: config.timeDimension.dimension,
    };

    if (config.timeDimension.granularity) {
      timeDim.granularity = config.timeDimension.granularity;
    }

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
    const memberFilters = config.filters.map(buildMemberFilter);

    if (config.filterLogic === "or") {
      query.filters = [{ or: memberFilters } as TCubeFilter];
    } else {
      query.filters = memberFilters;
    }
  }

  return query;
}

function isMemberFilter(f: TCubeFilter): f is TMemberFilter {
  return "member" in f;
}

/**
 * Parse a Cube.js query back into ChartBuilderState.
 * Preserves absent granularity / dateRange instead of injecting defaults.
 */
export function parseQueryToState(query: TChartQuery): Partial<ChartBuilderState> {
  const state: Partial<ChartBuilderState> = {
    selectedMeasures: query.measures || [],
    customMeasures: [],
    selectedDimensions: query.dimensions || [],
    filters: [],
    filterLogic: "and",
    timeDimension: null,
  };

  if (query.filters && query.filters.length > 0) {
    const first = query.filters[0];

    if (!isMemberFilter(first) && "or" in first && query.filters.length === 1) {
      state.filterLogic = "or";
      state.filters = (first.or as TMemberFilter[]).map((f) => ({
        field: f.member,
        operator: f.operator,
        values: f.values || null,
      }));
    } else {
      state.filterLogic = "and";
      state.filters = query.filters.filter(isMemberFilter).map((f) => ({
        field: f.member,
        operator: f.operator,
        values: f.values || null,
      }));
    }
  }

  if (query.timeDimensions && query.timeDimensions.length > 0) {
    const timeDim = query.timeDimensions[0];
    const config: TimeDimensionConfig = {
      dimension: timeDim.dimension,
    };
    if (timeDim.granularity) {
      config.granularity = timeDim.granularity;
    }
    if (timeDim.dateRange) {
      config.dateRange = timeDim.dateRange as TimeDimensionConfig["dateRange"];
    }
    state.timeDimension = config;
  }

  return state;
}
