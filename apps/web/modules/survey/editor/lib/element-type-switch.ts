import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";

const CHOICE_TYPES: readonly string[] = [
  TSurveyElementTypeEnum.MultipleChoiceSingle,
  TSurveyElementTypeEnum.MultipleChoiceMulti,
  TSurveyElementTypeEnum.Ranking,
];

/**
 * The update for switching between single select, multi select and ranking: the options travel along
 * as they are, answer codes included, and the question code is not part of the update so it stays.
 * Logic and validation rules are dropped because their operators differ by type. `null` for any
 * other switch, which starts from the new type's defaults instead.
 */
export const getChoiceTypeSwitchUpdate = (
  card: { type: string; choices?: unknown },
  type: TSurveyElementTypeEnum
) => {
  if (card.type === type || !CHOICE_TYPES.includes(card.type) || !CHOICE_TYPES.includes(type)) return null;
  return { choices: card.choices, type, logic: undefined, validation: undefined };
};
