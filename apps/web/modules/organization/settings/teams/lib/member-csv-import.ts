import { toCsvLine } from "@/lib/utils/csv-cell";
import { MEMBER_ATTRIBUTE_MAX_BULK_ROWS } from "@/modules/ee/member-attributes/lib/limits";
import { prepareMemberAttributeValues } from "@/modules/ee/member-attributes/lib/values";
import { splitChipInput } from "@/modules/ui/components/tags-combobox/lib/chips";

/**
 * The members CSV import (ENG-7475): one file for new and existing members. Each column that names a
 * Member attribute key (by key or label) is an attribute; several values in a cell are separated by a
 * comma or a semicolon. Rows match members and pending invites by email: a new email becomes an invite
 * carrying its values, an existing one keeps its role and teams and only gets attribute updates.
 *
 * Pure, so the preview the import shows before applying and what it then sends are one decision.
 */

/** The member columns, with the spellings the template and the older template use. */
export const MEMBER_CSV_COLUMNS = {
  name: ["Full Name", "name"],
  email: ["Email Address", "email"],
  role: ["Organization Role", "Role", "role"],
  teams: ["Teams", "teams"],
} as const;

const MEMBER_COLUMN_NAMES = new Set(
  Object.values(MEMBER_CSV_COLUMNS)
    .flat()
    .map((name) => name.toLowerCase())
);

/** A loose email check, so an obviously broken cell is shown as invalid before anything is sent. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type TCsvAttributeKey = { key: string; label: string };

export type TMemberCsvRowProblem =
  | "missing_email"
  | "invalid_email"
  | "duplicate_email"
  | "too_many_values"
  | "value_too_long";

export type TMemberCsvEntry = {
  /** Row number in the file, 1 for the first data row. */
  rowNumber: number;
  name: string;
  email: string;
  roleCell: string;
  teamsCell: string;
  /** Values per attribute `key`, for the keys this file has a column for (an empty cell clears the key). */
  attributes: Record<string, string[]>;
  action: "invite" | "update" | "invalid";
  problems: TMemberCsvRowProblem[];
};

export type TMemberCsvPlan = {
  entries: TMemberCsvEntry[];
  /** Attribute keys the file has columns for, in the file's order. */
  attributeColumns: TCsvAttributeKey[];
  /** Columns that are neither a member column nor an attribute key: ignored on import. */
  unknownColumns: string[];
  summary: { rows: number; invites: number; updates: number; invalid: number };
  /** More rows than one import takes (`MEMBER_ATTRIBUTE_MAX_BULK_ROWS`). */
  tooManyRows: boolean;
};

export type TMemberCsvRecord = Record<string, string | undefined>;

const readCell = (row: TMemberCsvRecord, names: readonly string[]): string => {
  for (const name of names) {
    const value = row[name];
    if (typeof value === "string" && value !== "") return value;
  }
  return "";
};

/** Which attribute key a header names: its key exactly, or its label ignoring case and spaces. */
const resolveAttributeColumn = (
  header: string,
  keys: readonly TCsvAttributeKey[]
): TCsvAttributeKey | undefined => {
  const normalized = header.trim().toLowerCase();
  return (
    keys.find((key) => key.key === normalized) ??
    keys.find((key) => key.label.trim().toLowerCase() === normalized)
  );
};

export const planMemberCsvImport = ({
  headers,
  rows,
  attributeKeys,
  existingEmails,
}: {
  headers: readonly string[];
  rows: readonly TMemberCsvRecord[];
  attributeKeys: readonly TCsvAttributeKey[];
  /** Emails of members and pending invites, any case. */
  existingEmails: Iterable<string>;
}): TMemberCsvPlan => {
  const existing = new Set([...existingEmails].map((email) => email.trim().toLowerCase()));
  const attributeColumns: { header: string; key: TCsvAttributeKey }[] = [];
  const unknownColumns: string[] = [];

  for (const header of headers) {
    if (header.trim() === "" || MEMBER_COLUMN_NAMES.has(header.trim().toLowerCase())) continue;
    const key = resolveAttributeColumn(header, attributeKeys);
    if (key && !attributeColumns.some((column) => column.key.key === key.key)) {
      attributeColumns.push({ header, key });
    } else if (!key) {
      unknownColumns.push(header);
    }
  }

  const seen = new Set<string>();
  const entries = rows.slice(0, MEMBER_ATTRIBUTE_MAX_BULK_ROWS).map((row, index): TMemberCsvEntry => {
    const email = readCell(row, MEMBER_CSV_COLUMNS.email).trim().toLowerCase();
    const problems: TMemberCsvRowProblem[] = [];

    if (email === "") problems.push("missing_email");
    else if (!EMAIL_PATTERN.test(email)) problems.push("invalid_email");
    else if (seen.has(email)) problems.push("duplicate_email");
    if (email !== "") seen.add(email);

    const attributes: Record<string, string[]> = {};
    for (const { header, key } of attributeColumns) {
      const prepared = prepareMemberAttributeValues(splitChipInput(row[header] ?? ""));
      if (prepared.ok) {
        attributes[key.key] = prepared.values;
      } else if (prepared.problem.code === "too_many_values") {
        problems.push("too_many_values");
      } else {
        problems.push("value_too_long");
      }
    }

    let action: TMemberCsvEntry["action"] = "invite";
    if (problems.length > 0) action = "invalid";
    else if (existing.has(email)) action = "update";

    return {
      rowNumber: index + 1,
      name: readCell(row, MEMBER_CSV_COLUMNS.name).trim(),
      email,
      roleCell: readCell(row, MEMBER_CSV_COLUMNS.role),
      teamsCell: readCell(row, MEMBER_CSV_COLUMNS.teams),
      attributes,
      action,
      problems,
    };
  });

  return {
    entries,
    attributeColumns: attributeColumns.map(({ key }) => key),
    unknownColumns,
    summary: {
      rows: entries.length,
      invites: entries.filter((entry) => entry.action === "invite").length,
      updates: entries.filter((entry) => entry.action === "update").length,
      invalid: entries.filter((entry) => entry.action === "invalid").length,
    },
    tooManyRows: rows.length > MEMBER_ATTRIBUTE_MAX_BULK_ROWS,
  };
};

/**
 * The bulk values rows an import sends: every valid row that has attribute columns, invites included
 * (their values attach to the invite once it is created, and move to the membership on acceptance).
 */
export const toBulkAttributeRows = (
  plan: TMemberCsvPlan
): { email: string; attributes: Record<string, string[]> }[] =>
  plan.attributeColumns.length === 0
    ? []
    : plan.entries
        .filter((entry) => entry.action !== "invalid")
        .map((entry) => ({ email: entry.email, attributes: entry.attributes }));

/**
 * The CSV template: the member columns, then one column per attribute key, and one example row. Every
 * cell goes through `toCsvLine`, which defangs formula injection — a key or label is user-controlled.
 */
export const buildMemberCsvTemplate = (attributeKeys: readonly TCsvAttributeKey[]): string =>
  toCsvLine([
    MEMBER_CSV_COLUMNS.name[0],
    MEMBER_CSV_COLUMNS.email[0],
    MEMBER_CSV_COLUMNS.role[0],
    MEMBER_CSV_COLUMNS.teams[0],
    ...attributeKeys.map((key) => key.key),
  ]) + toCsvLine(["Jane Doe", "jane@example.com", "Member", "", ...attributeKeys.map(() => "")]);
