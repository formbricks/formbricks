import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import type { TExportColumnGroup } from "@/lib/analysis-export/column-selection";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import type { extractSurveyDetails } from "./utils";

export type TStandardColumnGroup = TExportColumnGroup & {
  /** The headers of the Standard export this entry owns, in file order. */
  headers: string[];
};

type TSurveyDetails = Pick<
  ReturnType<typeof extractSurveyDetails>,
  "metaDataFields" | "elements" | "hiddenFields" | "variables" | "userAttributes"
>;

/**
 * The Standard export's columns as the Include columns list shows them: one entry per fixed column, per
 * question (its Option ID column goes with it), per Embedded Data field. Flattened in order they are exactly
 * the header row of today's file, which is what `getResponseDownloadFile` writes.
 *
 * The contact attribute columns (`person.*`) come from the responses read, so a list made without responses
 * has none and the export always keeps them.
 */
export const standardColumnGroups = ({
  survey,
  details,
  isQuotasAllowed,
}: {
  survey: TSurvey;
  details: TSurveyDetails;
  isQuotasAllowed: boolean;
}): TStandardColumnGroup[] => {
  const fixed = (id: string, label: string, header: string): TStandardColumnGroup => ({
    id,
    label,
    headers: [header],
  });
  const field = (prefix: string, header: string): TStandardColumnGroup => ({
    id: `${prefix}:${header}`,
    label: header,
    headers: [header],
  });

  const questions = getElementsFromBlocks(replaceHeadlineRecall(survey, "default").blocks);
  const questionGroups = details.elements.map((headers, index): TStandardColumnGroup => {
    const element = questions[index];
    const headline = element ? getTextContent(getLocalizedValue(element.headline, "default")) : "";
    const code = element && "code" in element && element.code ? element.code : String(index + 1);
    return {
      id: `q:${element?.id ?? index}`,
      label: headline ? `${code} · ${headline}` : code,
      headers,
    };
  });

  const groups: TStandardColumnGroup[] = [
    fixed("no", "no.", "No."),
    fixed("responseId", "responseId", "Response ID"),
    fixed("timestamp", "timestamp", "Timestamp"),
    fixed("finished", "finished", "Finished"),
    ...(isQuotasAllowed ? [fixed("quotas", "quotas", "Quotas")] : []),
    fixed("surveyId", "surveyId", "Survey ID"),
    fixed("formbricksId", "formbricksId", "Formbricks ID (internal)"),
    fixed("userId", "userId", "User ID"),
    fixed("tags", "tags", "Tags"),
    ...(details.metaDataFields.length > 0
      ? [{ id: "metadata", label: "metadata", headers: details.metaDataFields }]
      : []),
    ...questionGroups,
    ...details.variables.map((header) => field("e", header)),
    ...details.hiddenFields.map((header) => field("e", header)),
    ...(details.userAttributes.length > 0
      ? [
          {
            id: "person",
            label: "person",
            headers: details.userAttributes.map((attribute) => `person.${attribute}`),
          },
        ]
      : []),
    ...(survey.isVerifyEmailEnabled ? [fixed("verifiedEmail", "verifiedEmail", "Verified Email")] : []),
  ];
  return groups;
};

/** The header row of the Standard export without the switched-off groups. Nothing off: every header. */
export const standardHeaders = (
  groups: readonly TStandardColumnGroup[],
  excluded: readonly string[] = []
): string[] => groups.filter((group) => !excluded.includes(group.id)).flatMap((group) => group.headers);
