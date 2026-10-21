import type { TShowConditionSingle, TShowConditions } from "@formbricks/types/show-conditions";
import { evaluateShowConditions } from "@formbricks/types/show-conditions-evaluate";
import { listShowConditions } from "@/modules/show-conditions/lib/tree";

/**
 * "Test your URL": checks a pasted URL against the conditions that read the URL, with the same
 * evaluator the SDK runs, so the editor and the visitor's browser cannot disagree (ENG-3873).
 * Conditions on the referrer, the visit or the device cannot be read from a URL and are left out.
 */

const URL_OPERANDS = new Set(["currentUrl", "queryParam"]);

export interface TUrlTestResult {
  condition: TShowConditionSingle;
  passed: boolean;
}

/** The SDK always sees an absolute URL, so a bare `medicare.gov/plans` gets the scheme it would have. */
export const normalizeTestUrl = (input: string): string => {
  const trimmed = input.trim();
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export const listUrlTestableConditions = (conditions: TShowConditions): TShowConditionSingle[] =>
  listShowConditions(conditions).filter((condition) => URL_OPERANDS.has(condition.leftOperand.value));

export const testUrlAgainstShowConditions = (
  conditions: TShowConditions,
  input: string
): TUrlTestResult[] => {
  const url = normalizeTestUrl(input);
  return listUrlTestableConditions(conditions).map((condition) => ({
    condition,
    passed: evaluateShowConditions(
      { id: "url-test", connector: "and", conditions: [condition] },
      // Nothing below is read by a URL condition; it only has to be a valid context.
      {
        url,
        pageReferrer: "",
        visit: null,
        device: { deviceType: "desktop", browser: "other", screenWidth: 0 },
      }
    ).passed,
  }));
};
