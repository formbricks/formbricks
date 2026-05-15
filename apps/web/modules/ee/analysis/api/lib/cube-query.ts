import "server-only";
import type { TChartQuery } from "@formbricks/types/analysis";

export const TENANT_MEMBER = "FeedbackRecords.tenantId";

const ALLOWED_CUBE_PREFIXES = ["FeedbackRecords."];
const INVALID_MEMBER_REFERENCE = "invalid member reference";

type TQueryAuditSummary = {
  measures: string[];
  dimensions: string[];
  segments: string[];
  timeDimensions: string[];
  filterMembers: string[];
  filterCount: number;
  orderMembers: string[];
  limit?: number;
};

type TMemberValidationResult = {
  invalidMembers: string[];
  tenantMembers: string[];
};

type TCollectedMembers = {
  members: string[];
  invalidMemberCount: number;
};

type TCollectedFilterMembers = TCollectedMembers & {
  count: number;
};

type TFilterCollectionCounter = {
  value: number;
};

type TFilterCollectionState = {
  members: string[];
  filterCount: TFilterCollectionCounter;
  invalidMemberCount: TFilterCollectionCounter;
};

type TFilterShape = {
  hasMember: boolean;
  hasDimension: boolean;
  hasAnd: boolean;
  hasOr: boolean;
};

const uniqueSorted = (values: string[]): string[] =>
  Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const collectStringMembers = (values: unknown): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter((value): value is string => typeof value === "string");
};

const collectTimeDimensionMembers = (timeDimensions: unknown): string[] => {
  if (!Array.isArray(timeDimensions)) {
    return [];
  }

  return timeDimensions
    .map((timeDimension) => (isRecord(timeDimension) ? timeDimension.dimension : null))
    .filter((dimension): dimension is string => typeof dimension === "string");
};

const validateMemberPrefix = (member: string): boolean =>
  ALLOWED_CUBE_PREFIXES.some((prefix) => member.startsWith(prefix));

const collectOrderMembers = (order: unknown): TCollectedMembers => {
  const members: string[] = [];
  let invalidMemberCount = 0;

  if (order === undefined || order === null) {
    return { members, invalidMemberCount };
  }

  if (Array.isArray(order)) {
    for (const orderEntry of order) {
      if (Array.isArray(orderEntry) && typeof orderEntry[0] === "string") {
        members.push(orderEntry[0]);
      } else {
        invalidMemberCount += 1;
      }
    }

    return { members, invalidMemberCount };
  }

  if (isRecord(order)) {
    return { members: Object.keys(order), invalidMemberCount };
  }

  return { members, invalidMemberCount: 1 };
};

const createFilterCollectionState = (
  members: string[],
  count?: TFilterCollectionCounter,
  invalidCount?: TFilterCollectionCounter
): TFilterCollectionState => ({
  members,
  filterCount: count ?? { value: 0 },
  invalidMemberCount: invalidCount ?? { value: 0 },
});

const toCollectedFilterMembers = ({
  members,
  filterCount,
  invalidMemberCount,
}: TFilterCollectionState): TCollectedFilterMembers => ({
  members,
  count: filterCount.value,
  invalidMemberCount: invalidMemberCount.value,
});

const markInvalidFilterMember = (state: TFilterCollectionState): void => {
  state.invalidMemberCount.value += 1;
};

const getFilterShape = (filter: Record<string, unknown>): TFilterShape => ({
  hasMember: Object.hasOwn(filter, "member"),
  hasDimension: Object.hasOwn(filter, "dimension"),
  hasAnd: Object.hasOwn(filter, "and"),
  hasOr: Object.hasOwn(filter, "or"),
});

const hasInvalidDirectFilterMember = (
  filter: Record<string, unknown>,
  { hasMember, hasDimension }: TFilterShape
): boolean =>
  (hasMember && typeof filter.member !== "string") || (hasDimension && typeof filter.dimension !== "string");

const hasAnyFilterShapeProperty = ({ hasMember, hasDimension, hasAnd, hasOr }: TFilterShape): boolean =>
  hasMember || hasDimension || hasAnd || hasOr;

const collectDirectFilterMembers = (filter: Record<string, unknown>, state: TFilterCollectionState): void => {
  for (const member of [filter.member, filter.dimension]) {
    if (typeof member === "string") {
      state.members.push(member);
      state.filterCount.value += 1;
    }
  }
};

const collectNestedFilterMembers = (
  filter: Record<string, unknown>,
  property: "and" | "or",
  state: TFilterCollectionState
): void => {
  if (!Object.hasOwn(filter, property)) {
    return;
  }

  const nestedFilters = filter[property];
  if (Array.isArray(nestedFilters)) {
    collectFilterMemberNodes(nestedFilters, state);
    return;
  }

  markInvalidFilterMember(state);
};

const collectFilterMemberNode = (filter: unknown, state: TFilterCollectionState): void => {
  if (!isRecord(filter)) {
    markInvalidFilterMember(state);
    return;
  }

  const filterShape = getFilterShape(filter);
  collectDirectFilterMembers(filter, state);

  if (hasInvalidDirectFilterMember(filter, filterShape)) {
    markInvalidFilterMember(state);
  }

  collectNestedFilterMembers(filter, "and", state);
  collectNestedFilterMembers(filter, "or", state);

  if (!hasAnyFilterShapeProperty(filterShape)) {
    markInvalidFilterMember(state);
  }
};

function collectFilterMemberNodes(filters: unknown[], state: TFilterCollectionState): void {
  for (const filter of filters) {
    collectFilterMemberNode(filter, state);
  }
}

const collectFilterMembers = (
  filters: unknown,
  members: string[] = [],
  count?: { value: number },
  invalidCount?: { value: number }
): TCollectedFilterMembers => {
  const state = createFilterCollectionState(members, count, invalidCount);

  if (filters === undefined) {
    return toCollectedFilterMembers(state);
  }

  if (!Array.isArray(filters)) {
    markInvalidFilterMember(state);
    return toCollectedFilterMembers(state);
  }

  collectFilterMemberNodes(filters, state);
  return toCollectedFilterMembers(state);
};

const addValidatedMember = (member: string, result: TMemberValidationResult): void => {
  if (member === TENANT_MEMBER) {
    result.tenantMembers.push(member);
  } else if (!validateMemberPrefix(member)) {
    result.invalidMembers.push(member);
  }
};

const addInvalidMemberReferences = (result: TMemberValidationResult, count = 1): void => {
  for (let index = 0; index < count; index += 1) {
    result.invalidMembers.push(INVALID_MEMBER_REFERENCE);
  }
};

const addValidatedMemberReference = (member: unknown, result: TMemberValidationResult): void => {
  if (typeof member === "string") {
    addValidatedMember(member, result);
    return;
  }

  addInvalidMemberReferences(result);
};

const addValidatedMemberArray = (members: unknown, result: TMemberValidationResult): void => {
  if (members === undefined) {
    return;
  }

  if (!Array.isArray(members)) {
    addInvalidMemberReferences(result);
    return;
  }

  for (const member of members) {
    addValidatedMemberReference(member, result);
  }
};

const addValidatedTimeDimensions = (timeDimensions: unknown, result: TMemberValidationResult): void => {
  if (timeDimensions === undefined) {
    return;
  }

  if (!Array.isArray(timeDimensions)) {
    addInvalidMemberReferences(result);
    return;
  }

  for (const timeDimension of timeDimensions) {
    if (isRecord(timeDimension) && typeof timeDimension.dimension === "string") {
      addValidatedMember(timeDimension.dimension, result);
      continue;
    }

    addInvalidMemberReferences(result);
  }
};

/**
 * Validates all Cube member references controlled by users, saved charts, or AI output.
 * Tenant scoping is deliberately excluded from query JSON and enforced by Cube queryRewrite.
 */
export const validateCubeQueryMembers = (query: TChartQuery): void => {
  const result: TMemberValidationResult = {
    invalidMembers: [],
    tenantMembers: [],
  };
  const cubeQuery = isRecord(query) ? query : {};
  if (!isRecord(query)) {
    addInvalidMemberReferences(result);
  }

  const filters = collectFilterMembers(cubeQuery.filters);
  const order = collectOrderMembers(cubeQuery.order);

  addValidatedMemberArray(cubeQuery.measures, result);
  addValidatedMemberArray(cubeQuery.dimensions, result);
  addValidatedMemberArray(cubeQuery.segments, result);
  addValidatedTimeDimensions(cubeQuery.timeDimensions, result);
  for (const member of filters.members) addValidatedMember(member, result);
  for (const member of order.members) addValidatedMember(member, result);
  addInvalidMemberReferences(result, filters.invalidMemberCount + order.invalidMemberCount);

  if (result.tenantMembers.length > 0) {
    throw new Error(
      `Tenant filters are enforced by Cube and cannot be included in chart queries: ${uniqueSorted(
        result.tenantMembers
      ).join(", ")}`
    );
  }

  if (result.invalidMembers.length > 0) {
    throw new Error(
      `Invalid query members (must start with FeedbackRecords.): ${uniqueSorted(result.invalidMembers).join(
        ", "
      )}`
    );
  }
};

export const getCubeQueryAuditSummary = (query: TChartQuery): TQueryAuditSummary => {
  const cubeQuery = isRecord(query) ? query : {};
  const filters = collectFilterMembers(cubeQuery.filters);
  const order = collectOrderMembers(cubeQuery.order);

  return {
    measures: uniqueSorted(collectStringMembers(cubeQuery.measures)),
    dimensions: uniqueSorted(collectStringMembers(cubeQuery.dimensions)),
    segments: uniqueSorted(collectStringMembers(cubeQuery.segments)),
    timeDimensions: uniqueSorted(collectTimeDimensionMembers(cubeQuery.timeDimensions)),
    filterMembers: uniqueSorted(filters.members),
    filterCount: filters.count,
    orderMembers: uniqueSorted(order.members),
    ...(typeof cubeQuery.limit === "number" ? { limit: cubeQuery.limit } : {}),
  };
};
