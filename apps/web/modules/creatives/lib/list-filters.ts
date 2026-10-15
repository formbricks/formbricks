import type { TCreative, TCreativeType } from "../types";
import type { TCreativeDisplayState, TCreativeDisplayStatus } from "./display-status";

// The list toolbar's filters and sort, shaped like the surveys list: archived rows stay out of the
// default view and only show when the Archived status is picked.

export type TCreativeSortBy = "updatedAt" | "createdAt" | "name";

export interface TCreativeListFilters {
  name: string;
  status: TCreativeDisplayStatus[];
  type: TCreativeType[];
  sortBy: TCreativeSortBy;
}

export const INITIAL_CREATIVE_FILTERS: TCreativeListFilters = {
  name: "",
  status: [],
  type: [],
  sortBy: "updatedAt",
};

export interface TCreativeListRow {
  creative: TCreative;
  state: TCreativeDisplayState;
}

const matchesStatus = (status: TCreativeDisplayStatus, selected: TCreativeDisplayStatus[]): boolean =>
  selected.length === 0 ? status !== "archived" : selected.includes(status);

const compareRows = (sortBy: TCreativeSortBy) => (a: TCreativeListRow, b: TCreativeListRow) => {
  if (sortBy === "name") return a.creative.name.localeCompare(b.creative.name);
  return b.creative[sortBy].getTime() - a.creative[sortBy].getTime();
};

export const filterCreativeRows = (
  rows: TCreativeListRow[],
  { name, status, type, sortBy }: TCreativeListFilters
): TCreativeListRow[] => {
  const query = name.trim().toLowerCase();
  return rows
    .filter(
      (row) =>
        matchesStatus(row.state.status, status) &&
        (type.length === 0 || type.includes(row.creative.type)) &&
        (!query || row.creative.name.toLowerCase().includes(query))
    )
    .sort(compareRows(sortBy));
};

export const hasActiveCreativeFilters = ({ name, status, type }: TCreativeListFilters): boolean =>
  name.trim() !== "" || status.length > 0 || type.length > 0;
