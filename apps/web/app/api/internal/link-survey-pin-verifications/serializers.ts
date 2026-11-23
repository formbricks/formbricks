import type { TRendererCustomCss } from "@formbricks/types/custom-css";
import type { TSurvey } from "@formbricks/types/surveys/types";

/**
 * What an unlocked PIN screen receives: the survey without its PIN and its stored custom CSS source, the
 * compiled CSS the link page would otherwise have rendered, and, for a PIN-protected survey, the token the
 * response routes accept as proof the PIN was entered. Timestamps travel as ISO strings.
 */
export type TLinkSurveyPinVerificationResource = {
  survey: TSurvey;
  customCss?: TRendererCustomCss;
  pinAuthToken?: string;
};

export const serializeLinkSurveyPinVerification = ({
  survey,
  customCss,
  pinAuthToken,
}: {
  survey: TSurvey;
  customCss: TRendererCustomCss | undefined;
  pinAuthToken: string | undefined;
}): TLinkSurveyPinVerificationResource => ({
  survey,
  ...(customCss ? { customCss } : {}),
  ...(pinAuthToken ? { pinAuthToken } : {}),
});
