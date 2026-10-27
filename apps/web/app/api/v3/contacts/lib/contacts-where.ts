import type {
  ContactAttributeWhereInput,
  ContactOrderByWithRelationInput,
  Prisma,
} from "@formbricks/database/prisma";
import type { TKeysetCursor } from "@/app/api/v3/lib/keyset-cursor";
import { escapeLikePattern } from "@/lib/utils/like-pattern";
import { buildContactWhereClause } from "@/modules/ee/contacts/lib/contacts";
import type { TV3ContactAttributeFilter, TV3ContactsSort } from "./parse-v3-contacts-list-query";

const INSENSITIVE = "insensitive" as const;

/**
 * "Set" means the attribute row exists *and* carries a value in the column its `dataType` reads: an
 * empty string for text, and a NULL typed column for number/date (a value that failed to parse on
 * write lands there as NULL).
 */
const setCondition = (filter: TV3ContactAttributeFilter): ContactAttributeWhereInput => {
  switch (filter.dataType) {
    case "string":
      return { value: { not: "" } };
    case "number":
      return { valueNumber: { not: null } };
    case "date":
      return { valueDate: { not: null } };
  }
};

/** The per-row condition an attribute filter puts on that key's `ContactAttribute` row. */
const rowCondition = (filter: TV3ContactAttributeFilter): ContactAttributeWhereInput => {
  if (filter.dataType === "string") {
    const [value] = filter.values;
    // Prisma wraps `contains`/`startsWith`/`endsWith` in wildcards without escaping the value, so a
    // filter for `%` would match every row.
    const pattern = value === undefined ? value : escapeLikePattern(value);
    switch (filter.operator) {
      case "in":
        return { value: { in: filter.values, mode: INSENSITIVE } };
      case "equals":
        return { value: { equals: value, mode: INSENSITIVE } };
      // Set-and-differs: a contact with no value for the key does not match; `isNotSet` covers it.
      case "notEquals":
        return { AND: [setCondition(filter), { NOT: { value: { equals: value, mode: INSENSITIVE } } }] };
      case "contains":
        return { value: { contains: pattern, mode: INSENSITIVE } };
      case "doesNotContain":
        return { AND: [setCondition(filter), { NOT: { value: { contains: pattern, mode: INSENSITIVE } } }] };
      case "startsWith":
        return { value: { startsWith: pattern, mode: INSENSITIVE } };
      case "endsWith":
        return { value: { endsWith: pattern, mode: INSENSITIVE } };
      case "isSet":
      case "isNotSet":
        return setCondition(filter);
    }
  }

  if (filter.dataType === "number") {
    const [value] = filter.values;
    switch (filter.operator) {
      case "in":
        return { valueNumber: { in: filter.values } };
      case "equals":
        return { valueNumber: { equals: value } };
      case "notEquals":
        return { AND: [setCondition(filter), { NOT: { valueNumber: { equals: value } } }] };
      case "greaterThan":
        return { valueNumber: { gt: value } };
      case "greaterEqual":
        return { valueNumber: { gte: value } };
      case "lessThan":
        return { valueNumber: { lt: value } };
      case "lessEqual":
        return { valueNumber: { lte: value } };
      case "isSet":
      case "isNotSet":
        return setCondition(filter);
    }
  }

  const [value] = filter.values;
  switch (filter.operator) {
    case "gte":
      return { valueDate: { gte: value } };
    case "lte":
      return { valueDate: { lte: value } };
    case "isSet":
    case "isNotSet":
      return setCondition(filter);
  }
};

/**
 * One attribute filter as a `Contact` condition. Every branch leads with `attributeKeyId`, so the
 * lookup is served by the `ContactAttribute (attributeKeyId, value|valueNumber|valueDate)` indexes —
 * and since the key id was resolved inside the authorized workspace, the filter cannot reach another
 * workspace's attribute rows.
 */
export const buildAttributeFilterCondition = (
  filter: TV3ContactAttributeFilter
): Prisma.ContactWhereInput => {
  // A repeated single-value operator (`contains=a&contains=b`) ANDs one condition per value.
  if (filter.operator !== "in" && filter.values.length > 1) {
    return {
      AND: filter.values.map((value) =>
        buildAttributeFilterCondition({ ...filter, values: [value] } as TV3ContactAttributeFilter)
      ),
    };
  }
  const row = { attributeKeyId: filter.attributeKeyId, ...rowCondition(filter) };
  return filter.operator === "isNotSet" ? { attributes: { none: row } } : { attributes: { some: row } };
};

/**
 * The full filter for the page and the count. Workspace scope first and always — the search clause
 * comes from `buildContactWhereClause`, the same helper the Contacts page uses today, so the two
 * searches cannot drift. Everything else is ANDed.
 */
export const buildV3ContactsWhere = ({
  workspaceId,
  search,
  createdAtGte,
  createdAtLte,
  filters,
}: {
  workspaceId: string;
  search?: string;
  createdAtGte?: Date;
  createdAtLte?: Date;
  filters: readonly TV3ContactAttributeFilter[];
}): Prisma.ContactWhereInput => {
  const and: Prisma.ContactWhereInput[] = filters.map(buildAttributeFilterCondition);

  if (createdAtGte || createdAtLte) {
    and.push({
      createdAt: { ...(createdAtGte && { gte: createdAtGte }), ...(createdAtLte && { lte: createdAtLte }) },
    });
  }

  // Escaped for the same reason as `rowCondition`: a search for `%` would otherwise match every contact.
  const base = buildContactWhereClause(workspaceId, search ? escapeLikePattern(search) : search);
  return and.length > 0 ? { ...base, AND: and } : base;
};

/** The keyset condition for the page after `cursor`, matching {@link buildV3ContactsOrderBy}. */
export const buildV3ContactsCursorWhere = (
  cursor: Pick<TKeysetCursor, "value" | "id">,
  sortBy: TV3ContactsSort
): Prisma.ContactWhereInput => {
  const value = new Date(cursor.value);
  const comparison = sortBy === "-createdAt" ? "lt" : "gt";
  return {
    OR: [{ createdAt: { [comparison]: value } }, { createdAt: value, id: { [comparison]: cursor.id } }],
  };
};

export const buildV3ContactsOrderBy = (sortBy: TV3ContactsSort): ContactOrderByWithRelationInput[] => {
  const direction = sortBy === "-createdAt" ? "desc" : "asc";
  return [{ createdAt: direction }, { id: direction }];
};
