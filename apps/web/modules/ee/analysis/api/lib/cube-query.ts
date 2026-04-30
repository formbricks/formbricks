import "server-only";
import type { TChartQuery } from "@formbricks/types/analysis";

export const TENANT_MEMBER = "FeedbackRecords.tenantId";

const ALLOWED_CUBE_PREFIXES = ["FeedbackRecords.", "TopicsUnnested."];

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

const uniqueSorted = (values: string[]): string[] =>
  Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

const validateMemberPrefix = (member: string): boolean =>
  ALLOWED_CUBE_PREFIXES.some((prefix) => member.startsWith(prefix));

const collectOrderMembers = (order: TChartQuery["order"]): string[] => {
  if (!order) {
    return [];
  }

  if (Array.isArray(order)) {
    return order.map(([member]) => member).filter((member): member is string => typeof member === "string");
  }

  return Object.keys(order);
};

const collectFilterMembers = (
  filters: TChartQuery["filters"],
  members: string[] = [],
  count?: { value: number }
): { members: string[]; count: number } => {
  const filterCount = count ?? { value: 0 };

  if (!Array.isArray(filters)) {
    return { members, count: filterCount.value };
  }

  for (const filter of filters) {
    const filterRecord = filter as { member?: unknown; dimension?: unknown };
    const filterMembers = [
      ...(typeof filterRecord.member === "string" ? [filterRecord.member] : []),
      ...(typeof filterRecord.dimension === "string" ? [filterRecord.dimension] : []),
    ];

    for (const member of filterMembers) {
      members.push(member);
      filterCount.value += 1;
    }

    if ("and" in filter && Array.isArray(filter.and)) {
      collectFilterMembers(filter.and, members, filterCount);
    }
    if ("or" in filter && Array.isArray(filter.or)) {
      collectFilterMembers(filter.or, members, filterCount);
    }
  }

  return { members, count: filterCount.value };
};

const addValidatedMember = (member: string, result: TMemberValidationResult): void => {
  if (member === TENANT_MEMBER) {
    result.tenantMembers.push(member);
  } else if (!validateMemberPrefix(member)) {
    result.invalidMembers.push(member);
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

  for (const member of query.measures ?? []) addValidatedMember(member, result);
  for (const member of query.dimensions ?? []) addValidatedMember(member, result);
  for (const member of query.segments ?? []) addValidatedMember(member, result);
  for (const timeDimension of query.timeDimensions ?? []) addValidatedMember(timeDimension.dimension, result);
  for (const member of collectFilterMembers(query.filters).members) addValidatedMember(member, result);
  for (const member of collectOrderMembers(query.order)) addValidatedMember(member, result);

  if (result.tenantMembers.length > 0) {
    throw new Error(
      `Tenant filters are enforced by Cube and cannot be included in chart queries: ${uniqueSorted(
        result.tenantMembers
      ).join(", ")}`
    );
  }

  if (result.invalidMembers.length > 0) {
    throw new Error(
      `Invalid query members (must start with FeedbackRecords. or TopicsUnnested.): ${uniqueSorted(
        result.invalidMembers
      ).join(", ")}`
    );
  }
};

export const getCubeQueryAuditSummary = (query: TChartQuery): TQueryAuditSummary => {
  const filters = collectFilterMembers(query.filters);

  return {
    measures: uniqueSorted(query.measures ?? []),
    dimensions: uniqueSorted(query.dimensions ?? []),
    segments: uniqueSorted(query.segments ?? []),
    timeDimensions: uniqueSorted((query.timeDimensions ?? []).map(({ dimension }) => dimension)),
    filterMembers: uniqueSorted(filters.members),
    filterCount: filters.count,
    orderMembers: uniqueSorted(collectOrderMembers(query.order)),
    ...(typeof query.limit === "number" ? { limit: query.limit } : {}),
  };
};
