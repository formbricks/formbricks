import { Prisma } from "@formbricks/database/prisma";
import type { TResponseFilterCriteriaShown } from "@formbricks/types/responses";
import { OPTION_LIST_NAMES, getOptionListKeyOfNoun } from "@formbricks/types/surveys/not-shown";
import { getOptionList } from "@formbricks/types/surveys/show-if";
import type { TSurvey } from "@formbricks/types/surveys/types";

/**
 * Shown / not shown filters (ENG-6951) on the not-shown record (`Response.notShown`, ADR 0029).
 *
 * The record lists only what the survey kept from a respondent: blocks passed over, elements hidden,
 * and per shown element the options, rows and columns it did not offer. Not listed means shown **or
 * never reached**, so "shown" needs evidence of reaching the item as well:
 *
 * - **not shown**: the record lists the target, or the element or block holding it. A respondent who
 *   was not shown a question was not shown its options either.
 * - **shown**: the record is there and lists neither the target nor what holds it, and the element
 *   has an answer or a `ttc` entry. The survey writes `ttc` for every element on a page the respondent
 *   submitted, answered or skipped, and never for an element show-if hid. A block is shown when one of
 *   its elements is. An option, row or column is shown when its element is and the record does not
 *   list it for that element.
 *
 * A response with no record (`null`, from before 6.2 or an older cached survey) is unknown and matches
 * neither. The page a respondent left without submitting has no `ttc` yet, so it is not "shown" either.
 *
 * Every condition is a JSON containment on the response row, and runs on the rows the query already
 * narrowed by `surveyId`. Targets the survey does not hold emit nothing, like the other criteria
 * groups.
 */

/** The record is there: not SQL `NULL`, and not a stored JSON `null` either. */
const HAS_RECORD: Prisma.ResponseWhereInput = { notShown: { not: Prisma.AnyNull } };

/** The record's array at `path` holds `id`. */
const listed = (path: string[], id: string): Prisma.ResponseWhereInput => ({
  notShown: { path, array_contains: [id] },
});

/**
 * The record's array at `path` does not hold `id`, including when the record has no such key: a
 * negated containment on a missing key is SQL `NULL`, which no `NOT` turns into a match.
 */
const notListed = (path: string[], id: string): Prisma.ResponseWhereInput => ({
  OR: [{ notShown: { path, equals: Prisma.DbNull } }, { NOT: listed(path, id) }],
});

/** The respondent submitted the page holding the element: it has an answer or a time entry. */
const reached = (elementId: string): Prisma.ResponseWhereInput => ({
  OR: [
    { ttc: { path: [elementId], not: Prisma.DbNull } },
    { data: { path: [elementId], not: Prisma.DbNull } },
  ],
});

type TSurveyIndex = {
  blocks: Map<string, TSurvey["blocks"][number]>;
  elements: Map<string, { element: TSurvey["blocks"][number]["elements"][number]; blockId: string }>;
};

const indexSurvey = (survey: TSurvey): TSurveyIndex => {
  const blocks = new Map<string, TSurvey["blocks"][number]>();
  const elements: TSurveyIndex["elements"] = new Map();
  for (const block of survey.blocks) {
    blocks.set(block.id, block);
    for (const element of block.elements) elements.set(element.id, { element, blockId: block.id });
  }
  return { blocks, elements };
};

const elementNotShown = (elementId: string, blockId: string): Prisma.ResponseWhereInput => ({
  OR: [listed(["elements"], elementId), listed(["blocks"], blockId)],
});

const elementShown = (elementId: string, blockId: string): Prisma.ResponseWhereInput[] => [
  HAS_RECORD,
  notListed(["elements"], elementId),
  notListed(["blocks"], blockId),
  reached(elementId),
];

const buildBlockCondition = (
  block: TSurvey["blocks"][number],
  op: TResponseFilterCriteriaShown["op"]
): Prisma.ResponseWhereInput => {
  if (op === "notShown") return listed(["blocks"], block.id);
  return {
    AND: [
      HAS_RECORD,
      notListed(["blocks"], block.id),
      { OR: block.elements.map((element) => reached(element.id)) },
    ],
  };
};

/** One condition as its clause and the clauses it costs, or null for a target the survey does not hold. */
const buildShownCondition = (
  index: TSurveyIndex,
  condition: TResponseFilterCriteriaShown
): { clause: Prisma.ResponseWhereInput; cost: number } | null => {
  if (condition.target === "block") {
    const block = index.blocks.get(condition.blockId);
    if (!block) return null;
    return { clause: buildBlockCondition(block, condition.op), cost: 3 + block.elements.length * 2 };
  }

  const located = index.elements.get(condition.elementId);
  if (!located) return null;
  const { element, blockId } = located;

  if (condition.target === "element") {
    const clause =
      condition.op === "notShown"
        ? elementNotShown(element.id, blockId)
        : { AND: elementShown(element.id, blockId) };
    return { clause, cost: 6 };
  }

  const listKey = getOptionListKeyOfNoun(condition.target);
  if (!listKey) return null;
  // `[]` when the element's type has no such list.
  if (!getOptionList(element, listKey).some((item) => item.id === condition.itemId)) return null;

  const path = [OPTION_LIST_NAMES[listKey].recordKey, element.id];
  const clause =
    condition.op === "notShown"
      ? { OR: [listed(path, condition.itemId), elementNotShown(element.id, blockId)] }
      : { AND: [...elementShown(element.id, blockId), notListed(path, condition.itemId)] };
  return { clause, cost: 8 };
};

/**
 * The `shown` criteria group as clauses to AND into the response query. `spend` charges each against
 * the call's clause budget (`buildWhereClause`).
 */
export const buildShownFilterClauses = (
  survey: TSurvey,
  conditions: readonly TResponseFilterCriteriaShown[] | undefined,
  spend: (count: number) => void
): Prisma.ResponseWhereInput[] => {
  if (!conditions?.length) return [];
  const index = indexSurvey(survey);
  const clauses: Prisma.ResponseWhereInput[] = [];
  for (const condition of conditions) {
    const built = buildShownCondition(index, condition);
    if (!built) continue;
    spend(built.cost);
    clauses.push(built.clause);
  }
  return clauses;
};
