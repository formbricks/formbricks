import { isRestrictedSurveyPick } from "@/modules/survey/visibility/lib/outbound";
import type { TDestinationSurveyOption } from "./destination-options";

export type TSurveyPickState = {
  /** Listed but can't be picked: a Restricted survey (ENG-3868) the creative doesn't already open. */
  disabled: boolean;
  /** Which badge the row carries, if any. */
  badge: "restricted" | "notAllowed" | null;
};

/**
 * How the On click picker shows one survey. Restricted surveys stay listed so the author sees why a
 * survey can't be picked, but they are disabled. The survey the creative already opens stays
 * selectable whatever it became, and is flagged when it can no longer be a Destination.
 */
export const getSurveyPickState = (
  option: TDestinationSurveyOption,
  linkedSurveyId: string | null
): TSurveyPickState => {
  // The creative rule applies whatever the organization's visibility plan (ENG-3868), hence `true`.
  const disabled = isRestrictedSurveyPick(true, option, linkedSurveyId ? [linkedSurveyId] : []);
  if (disabled) return { disabled, badge: "restricted" };
  return { disabled, badge: option.notAllowed ? "notAllowed" : null };
};

/**
 * The picker's surveys: the chosen one and the one the creative already opens, then the search results.
 * Those two stay whatever the search returns, since the combobox shows its value by finding it among the
 * options; and they win over a result with the same id, because only they know a linked survey is
 * `notAllowed` or archived.
 */
export const withPinnedSurveyOptions = (
  results: readonly TDestinationSurveyOption[],
  pinned: readonly (TDestinationSurveyOption | null)[]
): TDestinationSurveyOption[] => {
  const pinnedById = new Map<string, TDestinationSurveyOption>();
  for (const option of pinned) {
    if (option && !pinnedById.has(option.id)) pinnedById.set(option.id, option);
  }
  return [...pinnedById.values(), ...results.filter(({ id }) => !pinnedById.has(id))];
};
