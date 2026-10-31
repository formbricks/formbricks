import type { TSurveySignatureElement } from "@formbricks/types/surveys/elements";

type TSignatureSettings = Partial<Pick<TSurveySignatureElement, "required" | "allowTypedSignature">>;

/** The schema defaults `allowTypedSignature` to on, so an element that never stored it allows typing. */
export const isTypedSignatureAllowed = (element: TSignatureSettings): boolean =>
  element.allowTypedSignature ?? true;

/**
 * A required Signature that cannot be typed leaves keyboard and screen-reader respondents without a way
 * to answer: drawing is a pointer gesture. The editor warns the author about exactly this combination.
 */
export const shouldWarnTypedSignatureOff = (element: TSignatureSettings): boolean =>
  element.required === true && !isTypedSignatureAllowed(element);

/**
 * A required element can never be skipped, so logic offers no "is not signed" condition for it (see
 * `getElementOperatorOptions`). The editor says so, because nothing else explains why the option is missing.
 */
export const shouldShowNotSignedLogicHint = (element: TSignatureSettings): boolean =>
  element.required === true;
