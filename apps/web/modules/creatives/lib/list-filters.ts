import { z } from "zod";
import type { CreativeDisplayStatusZodType, CreativeTypeZodType } from "@formbricks/api-v3-schemas";

// The list toolbar's filters and sort, shaped like the surveys and workflows lists. The API does the
// filtering: with no status picked it leaves archived creatives out, so Archived is just one more
// status the author can pick.

export type TCreativeSortBy = "updatedAt" | "createdAt" | "name";

export interface TCreativeListFilters {
  name: string;
  displayStatuses: CreativeDisplayStatusZodType[];
  types: CreativeTypeZodType[];
  sortBy: TCreativeSortBy;
}

export const INITIAL_CREATIVE_FILTERS: TCreativeListFilters = {
  name: "",
  displayStatuses: [],
  types: [],
  sortBy: "updatedAt",
};

export const hasActiveCreativeFilters = ({ name, displayStatuses, types }: TCreativeListFilters): boolean =>
  name.trim() !== "" || displayStatuses.length > 0 || types.length > 0;

// Local enums rather than the generated schemas, which would pull the whole v3 schema module into the
// client bundle; `satisfies` keeps them within the contract's values.
const ZStoredCreativeFilters = z.object({
  name: z.string(),
  displayStatuses: z.array(
    z.enum([
      "draft",
      "scheduled",
      "active",
      "paused",
      "closed",
      "archived",
    ] as const satisfies readonly CreativeDisplayStatusZodType[])
  ),
  types: z.array(z.enum(["feedbackButton", "banner"] as const satisfies readonly CreativeTypeZodType[])),
  sortBy: z.enum(["updatedAt", "createdAt", "name"] as const satisfies readonly TCreativeSortBy[]),
});

/** Filters kept in localStorage between visits, like the surveys list. Anything unreadable reads as none. */
export const parseStoredCreativeFilters = (raw: string | null): TCreativeListFilters | null => {
  if (!raw) return null;
  try {
    const result = ZStoredCreativeFilters.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};
