import type { ShowConditionGroupZodType } from "@formbricks/api-v3-schemas";
import {
  type TShowConditionSingle,
  type TShowConditions,
  ZShowConditions,
} from "@formbricks/types/show-conditions";
import { isShowConditionGroup } from "@formbricks/types/show-conditions-evaluate";

// Kept apart from `creative.ts`, which loads the generated zod schemas: the editor builds its PATCH
// body with this in the browser.

export type TCreativeShowConditions = ShowConditionGroupZodType | null;

/**
 * Whether the API would refuse Show when, typically a condition still waiting for its value. The same
 * `ZShowConditions` the v3 write runs (`write-rules.ts`), so the editor and the API cannot disagree.
 */
export const hasIncompleteConditions = (conditions: TShowConditions): boolean =>
  !ZShowConditions.safeParse(conditions).success;

/**
 * Show when in the contract's two-level shape, which is also how it is stored. `ZShowConditions` allows
 * no deeper nesting, so the filter below only narrows the type; it drops nothing a valid value holds.
 */
export const toCreativeShowConditions = (conditions: TShowConditions): TCreativeShowConditions =>
  conditions && {
    id: conditions.id,
    connector: conditions.connector,
    conditions: conditions.conditions.map((item) =>
      isShowConditionGroup(item)
        ? {
            id: item.id,
            connector: item.connector,
            conditions: item.conditions.filter(
              (nested): nested is TShowConditionSingle => !isShowConditionGroup(nested)
            ),
          }
        : item
    ),
  };
