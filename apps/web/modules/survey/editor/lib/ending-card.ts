import { TSurveyEndScreenCard, TSurveyEnding, TSurveyRedirectUrlCard } from "@formbricks/types/surveys/types";
import { createI18nString } from "@/lib/i18n/utils";

/**
 * The patch to merge into an ending card when its type switch changes the card's type.
 *
 * Saving a card as "redirectToUrl" runs it through `ZSurveyRedirectUrlCard`, which strips every
 * endScreen-only field — so once the survey has been persisted, the card carries no `headline` key
 * at all. Switching it back to "endScreen" has to seed one, because the note editor drops keystrokes
 * for a field the card does not already carry: the field looks filled while `localSurvey` never
 * receives the text, and saving then rejects the note as missing.
 */
export const getEndingCardTypeChangePatch = (
  ending: TSurveyEnding,
  newType: TSurveyEnding["type"],
  languageCodes: string[]
): Partial<TSurveyEndScreenCard> | Partial<TSurveyRedirectUrlCard> => {
  if (newType === "redirectToUrl") {
    return { type: "redirectToUrl" };
  }

  // Switching type only patches `type`, so a card switched back and forth without an intervening
  // save still carries the headline it started with — keep that rather than blanking it. Hence the
  // `in` check: the card reads as a redirect card here, but may still hold the field.
  if ("headline" in ending && ending.headline) {
    return { type: "endScreen" };
  }

  return { type: "endScreen", headline: createI18nString("", languageCodes) };
};
