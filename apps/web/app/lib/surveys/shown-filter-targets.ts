import type { TFunction } from "i18next";
import type { TResponseFilterCriteriaShown } from "@formbricks/types/responses";
import type { TConditionGroup } from "@formbricks/types/surveys/logic";
import { type TOptionLike, type TOptionListKey, getOptionLists } from "@formbricks/types/surveys/show-if";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { recallToHeadline } from "@/lib/utils/recall";

/** What a shown / not shown filter names (ENG-6951): its criteria without the operator. */
export type TShownFilterTarget = TResponseFilterCriteriaShown extends infer TCondition
  ? TCondition extends unknown
    ? Omit<TCondition, "op">
    : never
  : never;

export type TShownFilterTargetEntry = {
  /** The filter property's id, in the URL syntax: `shown.<kind>.<id>[.<itemId>]`. */
  propertyId: string;
  target: TShownFilterTarget;
  label: string;
};

type TBlock = TSurvey["blocks"][number];
type TElement = TBlock["elements"][number];

const hasShowIf = (item: { showIf?: TConditionGroup }): boolean => (item.showIf?.conditions.length ?? 0) > 0;

/** An option, row or column a show-if or Hidden can keep from a respondent. */
const itemCanBeNotShown = (item: TOptionLike): boolean => hasShowIf(item) || item.hidden === true;

/**
 * An element the survey can keep from a respondent: its own show-if, or an option list every item of
 * which can be hidden (the element is then skipped with no options left).
 */
const elementCanBeNotShown = (element: TElement): boolean =>
  hasShowIf(element) ||
  getOptionLists(element).some(({ items }) => items.length > 0 && items.every(itemCanBeNotShown));

/** A block with its own show-if, or whose every element can be hidden (the block is then passed over). */
const blockCanBeNotShown = (block: TBlock): boolean =>
  hasShowIf(block) || block.elements.every(elementCanBeNotShown);

const KIND_OF: Record<TOptionListKey, "option" | "row" | "column"> = {
  choices: "option",
  rows: "row",
  columns: "column",
};

const headlineOf = (element: TElement, survey: TSurvey): string =>
  getTextContent(getLocalizedValue(recallToHeadline(element.headline, survey, false, "default"), "default"));

const itemLabelOf = (listKey: TOptionListKey, headline: string, itemLabel: string, t: TFunction): string => {
  if (listKey === "rows") {
    return t("workspace.surveys.filter.shown_target_row", { question: headline, row: itemLabel });
  }
  if (listKey === "columns") {
    return t("workspace.surveys.filter.shown_target_column", { question: headline, column: itemLabel });
  }
  return `${headline} · ${itemLabel}`;
};

const itemEntries = (element: TElement, headline: string, t: TFunction): TShownFilterTargetEntry[] =>
  getOptionLists(element).flatMap(({ listKey, items }) =>
    items.flatMap((item, index): TShownFilterTargetEntry[] => {
      if (!itemCanBeNotShown(item)) return [];
      const label = (item as { label?: Record<string, string> }).label;
      // Picture choices have no label: "Picture 2", as the rest of the filter names them.
      const itemLabel = label
        ? getTextContent(getLocalizedValue(label, "default"))
        : t("workspace.surveys.filter.shown_target_picture", { number: index + 1 });
      const kind = KIND_OF[listKey];
      return [
        {
          propertyId: `shown.${kind}.${element.id}.${item.id}`,
          target: { target: kind, elementId: element.id, itemId: item.id },
          label: itemLabelOf(listKey, headline, itemLabel, t),
        },
      ];
    })
  );

const elementEntries = (element: TElement, survey: TSurvey, t: TFunction): TShownFilterTargetEntry[] => {
  const headline = headlineOf(element, survey);
  return [
    ...(elementCanBeNotShown(element)
      ? [
          {
            propertyId: `shown.question.${element.id}`,
            target: { target: "element", elementId: element.id } as const,
            label: headline,
          },
        ]
      : []),
    ...itemEntries(element, headline, t),
  ];
};

/**
 * The blocks, questions, options, rows and columns a shown / not shown filter offers, in survey order:
 * the ones the survey can keep from a respondent today (a show-if, Hidden, or everything inside them
 * hideable). Anything else is never in a not-shown record, so a filter on it would only ever split
 * reached from not reached.
 */
export const getShownFilterTargets = (survey: TSurvey, t: TFunction): TShownFilterTargetEntry[] =>
  survey.blocks.flatMap((block) => [
    ...(blockCanBeNotShown(block)
      ? [
          {
            propertyId: `shown.block.${block.id}`,
            target: { target: "block", blockId: block.id } as const,
            label: t("workspace.surveys.filter.shown_target_block", { name: block.name }),
          },
        ]
      : []),
    ...block.elements.flatMap((element) => elementEntries(element, survey, t)),
  ]);
