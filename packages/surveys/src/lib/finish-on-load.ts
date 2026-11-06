import type { TResponseVariables } from "@formbricks/types/responses";
import type { TResponseNotShown } from "@formbricks/types/surveys/not-shown";

/**
 * A survey that finishes before the respondent answers anything (ENG-6931, ENG-6932): the rules
 * before the first question screened them out, or show-if passed over every block. Either way the
 * ending is on screen as the survey loads, and the survey creates the finished response itself.
 */
export interface TFinishOnLoad {
  variables: TResponseVariables;
  endingId: string | undefined;
  /** The not-shown record, when blocks were passed over on the way to the ending. */
  notShown?: TResponseNotShown;
}

/**
 * The finish to send now, or `null`. It waits for the display to settle, as every first submit does,
 * so the response is created against its display (and after an offline restore), and it is sent at
 * most once.
 */
export const getFinishOnLoadToSend = ({
  isDisplaySettled,
  alreadyHandled,
  screenOut,
  allHidden,
}: {
  isDisplaySettled: boolean;
  alreadyHandled: boolean;
  /** The start-logic screen-out, when the rules before the first question ended the survey. */
  screenOut: TFinishOnLoad | null;
  /** Every block passed over by show-if on entry. */
  allHidden: TFinishOnLoad | null;
}): TFinishOnLoad | null => {
  if (!isDisplaySettled || alreadyHandled) return null;
  return screenOut ?? allHidden;
};

/**
 * Gets the reCAPTCHA token a response create needs when spam protection is on, as the first submit
 * does. Returns whether the create may go ahead; on `false` the caller shows the reCAPTCHA error.
 */
export const prepareResponseCreate = async ({
  isSpamProtectionEnabled,
  hasResponseId,
  getRecaptchaToken,
  setRecaptchaToken,
}: {
  isSpamProtectionEnabled: boolean;
  hasResponseId: boolean;
  getRecaptchaToken?: () => Promise<string | null>;
  /** Hands the token to the response queue; `undefined` when there is no queue. */
  setRecaptchaToken?: (token: string) => void;
}): Promise<boolean> => {
  if (!isSpamProtectionEnabled || hasResponseId || !getRecaptchaToken) return true;
  const token = await getRecaptchaToken();
  if (!setRecaptchaToken || !token) return false;
  setRecaptchaToken(token);
  return true;
};
