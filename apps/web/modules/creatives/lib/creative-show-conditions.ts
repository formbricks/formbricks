import type { ShowConditionGroupZodType } from "@formbricks/api-v3-schemas";
import type { TShowConditionSingle, TShowConditions } from "@formbricks/types/show-conditions";
import { isShowConditionGroup } from "@formbricks/types/show-conditions-evaluate";

// Kept apart from `creative.ts`, which loads the generated zod schemas: the editor builds its PATCH
// body with this in the browser.

export type TCreativeShowConditions = ShowConditionGroupZodType | null;

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
