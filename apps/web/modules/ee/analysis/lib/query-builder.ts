/**
 * Query builder utility to construct Cube.js queries from chart builder state.
 */
import { TChartQuery, TCubeFilter, TMemberFilter, TTimeDimension } from "@formbricks/types/analysis";

export type TFilterFieldType = "string" | "number" | "time";

export interface FilterRow {
  id: string;
  field: string;
  operator: TMemberFilter["operator"];
  values: string[] | number[] | null;
}

/**
 * A group of filter nodes combined by their own AND/OR, sitting inside the surrounding list —
 * this is what makes `A AND (B OR C)` expressible instead of one flat list under one operator.
 *
 * `children` is recursive because the persisted wire format (`TCubeFilter`) is, so a query written
 * by the AI or by hand round-trips at any depth. The builder UI only ever *creates* one level of
 * grouping; deeper trees that arrive from elsewhere are preserved rather than dropped.
 */
export interface FilterGroup {
  id: string;
  logic: "and" | "or";
  children: FilterNode[];
}

export type FilterNode = FilterRow | FilterGroup;

export const isFilterGroup = (node: FilterNode): node is FilterGroup => "children" in node;

export interface TimeDimensionConfig {
  dimension: string;
  granularity?: "second" | "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year";
  dateRange?: string | [Date, Date];
}

export interface ChartBuilderState {
  selectedMeasures: string[];
  selectedDimensions: string[];
  filters: FilterNode[];
  /** Combines the top-level nodes; each group carries its own operator. */
  filterLogic: "and" | "or";
  timeDimension: TimeDimensionConfig | null;
  limit?: number;
  orderBy?: { field: string; direction: "asc" | "desc" };
  /**
   * When true and `FeedbackRecords.valueText` is in `selectedDimensions`, the emitted Cube
   * query swaps that dimension to `FeedbackRecords.valueId` so Cube groups by the stable
   * choice id instead of the submitted label. Set this when the chart is scoped to a
   * single-select question (the caller that knows the question type must set it; the chart
   * builder itself has no access to survey metadata). The server action also performs this
   * rewrite automatically when it can detect the field type, so this flag is primarily
   * useful for callers that want explicit control (e.g. tests, programmatic chart creation).
   */
  groupByOptionId?: boolean;
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

/** Returns null for a group that contributes nothing, so no `{and: []}` reaches the query. */
function buildFilterNode(node: FilterNode): TCubeFilter | null {
  if (!isFilterGroup(node)) {
    return buildMemberFilter(node);
  }

  const children = node.children.map(buildFilterNode).filter((child): child is TCubeFilter => child !== null);

  if (children.length === 0) {
    return null;
  }

  return node.logic === "or" ? { or: children } : { and: children };
}

/**
 * Serialize the filter tree into Cube's `filters` array.
 *
 * The top-level array is an implicit AND, and Cube appends the tenant filter to it
 * (`docker/cube/cube.js` queryRewrite), so a whole-expression OR has to be emitted as one wrapped
 * node — never as a bare OR list that the tenant filter would join.
 */
function buildFilterTree(filters: FilterNode[], filterLogic: "and" | "or"): TCubeFilter[] | undefined {
  const nodes = filters.map(buildFilterNode).filter((node): node is TCubeFilter => node !== null);

  if (nodes.length === 0) {
    return undefined;
  }

  return filterLogic === "or" ? [{ or: nodes }] : nodes;
}

/**
 * Build a Cube.js query from chart builder state.
 *
 * When `config.groupByOptionId` is true and `FeedbackRecords.valueText` is among the selected
 * dimensions, it is replaced with `FeedbackRecords.valueId` in the emitted query so Cube groups
 * by the stable choice id rather than the submitted label.
 */
export function buildCubeQuery(config: ChartBuilderState): TChartQuery {
  const query: TChartQuery = {
    measures: [...config.selectedMeasures],
  };

  if (config.selectedDimensions.length > 0) {
    const dimensions = config.groupByOptionId
      ? config.selectedDimensions.map((d) =>
          d === "FeedbackRecords.valueText" ? "FeedbackRecords.valueId" : d
        )
      : config.selectedDimensions;
    query.dimensions = dimensions;
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
      const formatDate = (date: Date | string) => {
        // dateRange round-trips through JSON (saved chart → parseQueryToState), so the array
        // elements may already be ISO strings — coerce before formatting.
        const d = date instanceof Date ? date : new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };
      timeDim.dateRange = [formatDate(startDate), formatDate(endDate)];
    }

    query.timeDimensions = [timeDim];
  }

  const filters = buildFilterTree(config.filters, config.filterLogic);
  if (filters) {
    query.filters = filters;
  }

  return query;
}

function isMemberFilter(f: TCubeFilter): f is TMemberFilter {
  return "member" in f;
}

function toFilterRow(f: TMemberFilter): FilterRow {
  return {
    id: crypto.randomUUID(),
    field: f.member,
    operator: f.operator,
    values: f.values || null,
  };
}

function parseFilterNode(filter: TCubeFilter): FilterNode | null {
  if (isMemberFilter(filter)) {
    return toFilterRow(filter);
  }

  const logic = "or" in filter ? "or" : "and";
  const source = "or" in filter ? filter.or : filter.and;
  // A node that is neither a member filter nor a well-formed and/or is not something the builder can
  // represent — Cube's legacy `dimension` alias for `member`, say, or a hand-edited row. Drop it, as
  // the flat parser this replaced did, rather than throwing and taking the whole panel down.
  if (!Array.isArray(source)) {
    return null;
  }
  const children = source.map(parseFilterNode).filter((child): child is FilterNode => child !== null);

  if (children.length === 0) {
    return null;
  }

  return { id: crypto.randomUUID(), logic, children };
}

/**
 * Parse Cube's `filters` array back into the builder's filter tree, preserving nesting.
 *
 * A lone top-level `{ or: [...] }` is lifted back into a flat list under a top-level OR rather than
 * shown as a group. That is the shape the flat "match any" builder emitted, so charts saved before
 * groups existed look exactly as they did — and it is also what this builder emits for a top-level
 * OR, so anything saved under one is drawn on reload the way it was built. The lift is deliberately
 * not gated on the children being plain conditions: `A OR (B AND C)` would otherwise come back as a
 * single OR group wrapping an AND group, which is the same expression drawn differently from what
 * the user built. Both forms re-serialize identically, so the lift stays lossless.
 *
 * Only `or` is lifted. A lone `{ and: [...] }` genuinely loses its wrapper, since the top level is
 * already an implicit AND but a group the user drew is still theirs to see.
 */
function parseFilters(filters: TCubeFilter[]): {
  filters: FilterNode[];
  filterLogic: "and" | "or";
} {
  const [first] = filters;

  if (filters.length === 1 && !isMemberFilter(first) && "or" in first && Array.isArray(first.or)) {
    const lifted = first.or.map(parseFilterNode).filter((node): node is FilterNode => node !== null);
    // An empty OR carries no condition at all. Falling through leaves it to the general path, which
    // prunes it away, rather than lifting it into a top-level OR of nothing.
    if (lifted.length > 0) {
      return { filters: lifted, filterLogic: "or" };
    }
  }

  return {
    filters: filters.map(parseFilterNode).filter((node): node is FilterNode => node !== null),
    filterLogic: "and",
  };
}

/** Appends `node` to the top level, or inside the group with `parentId` when one is given. */
export function addFilterNode(nodes: FilterNode[], node: FilterNode, parentId?: string | null): FilterNode[] {
  if (!parentId) {
    return [...nodes, node];
  }

  return nodes.map((current) => {
    if (!isFilterGroup(current)) return current;
    if (current.id === parentId) {
      return { ...current, children: [...current.children, node] };
    }
    return { ...current, children: addFilterNode(current.children, node, parentId) };
  });
}

/** Removes a condition or a whole group, dropping any group the removal leaves empty. */
export function removeFilterNode(nodes: FilterNode[], id: string): FilterNode[] {
  const remaining: FilterNode[] = [];

  for (const node of nodes) {
    if (node.id === id) continue;

    if (isFilterGroup(node)) {
      const children = removeFilterNode(node.children, id);
      if (children.length === 0) continue;
      remaining.push({ ...node, children });
    } else {
      remaining.push(node);
    }
  }

  return remaining;
}

export function updateFilterRow(nodes: FilterNode[], id: string, updates: Partial<FilterRow>): FilterNode[] {
  return nodes.map((node) => {
    if (isFilterGroup(node)) {
      return { ...node, children: updateFilterRow(node.children, id, updates) };
    }
    if (node.id !== id) return node;

    const updated = { ...node, ...updates };
    // `set` / `notSet` take no operand, so a value left over from the previous operator is dropped.
    if (updated.operator === "set" || updated.operator === "notSet") {
      updated.values = null;
    }
    return updated;
  });
}

export function updateFilterGroupLogic(nodes: FilterNode[], id: string, logic: "and" | "or"): FilterNode[] {
  return nodes.map((node) => {
    if (!isFilterGroup(node)) return node;
    if (node.id === id) return { ...node, logic };
    return { ...node, children: updateFilterGroupLogic(node.children, id, logic) };
  });
}

/**
 * True when any condition anywhere in the tree still needs a value — the builder skips running
 * (and re-running) the query while a row is half-filled.
 */
export function hasIncompleteFilterRow(nodes: FilterNode[]): boolean {
  return nodes.some((node) => {
    if (isFilterGroup(node)) return hasIncompleteFilterRow(node.children);
    if (node.operator === "set" || node.operator === "notSet") return false;
    return node.values === null || node.values.length === 0;
  });
}

/**
 * Parse a Cube.js query back into ChartBuilderState.
 * Preserves absent granularity / dateRange instead of injecting defaults.
 */
export function parseQueryToState(query: TChartQuery): Partial<ChartBuilderState> {
  const state: Partial<ChartBuilderState> = {
    selectedMeasures: query.measures || [],
    selectedDimensions: query.dimensions || [],
    filters: [],
    filterLogic: "and",
    timeDimension: null,
  };

  if (query.filters && query.filters.length > 0) {
    const parsed = parseFilters(query.filters);
    state.filters = parsed.filters;
    state.filterLogic = parsed.filterLogic;
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
      if (typeof timeDim.dateRange === "string") {
        config.dateRange = timeDim.dateRange;
      } else if (Array.isArray(timeDim.dateRange) && timeDim.dateRange.length === 2) {
        // Stored as [isoString, isoString]; lift back into Date objects for the date-picker UI.
        config.dateRange = [new Date(timeDim.dateRange[0]), new Date(timeDim.dateRange[1])];
      }
    }
    state.timeDimension = config;
  }

  return state;
}
