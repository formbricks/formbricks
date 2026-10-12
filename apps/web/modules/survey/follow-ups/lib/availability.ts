type TFollowUpsAvailabilityInput = Readonly<{
  isSurveyFollowUpsAllowed: boolean;
  isWorkflowsAllowed: boolean;
  /** The survey is restricted and the restricted-surveys gate is on (`isOutboundBlocked`). */
  isRestricted: boolean;
}>;

type TFollowUpsAvailability = Readonly<{
  /** Whether the Follow-ups tab offers "New follow-up" at all (rendered, possibly disabled). */
  isCreationOffered: boolean;
  /** Whether a new follow-up can be started right now: the entry point is offered and enabled. */
  canCreate: boolean;
  /** Whether the survey's follow-ups are actually sent when a response comes in. */
  isSending: boolean;
}>;

/**
 * What the Follow-ups tab lets the user do.
 *
 * Follow-ups are deprecated, so a new one can only be started where Workflows cannot reach yet.
 * They send on the organization's entitlement, and — while survey visibility is enforced — only for
 * a workspace-visible survey: the response pipeline skips a restricted survey's follow-ups (ENG-3283),
 * so creating one there would save automation that silently never sends. Existing follow-ups stay
 * listed either way so their owner can read, fix and migrate them.
 */
export const getFollowUpsAvailability = ({
  isSurveyFollowUpsAllowed,
  isWorkflowsAllowed,
  isRestricted,
}: TFollowUpsAvailabilityInput): TFollowUpsAvailability => {
  const isCreationOffered = isSurveyFollowUpsAllowed && !isWorkflowsAllowed;
  return {
    isCreationOffered,
    canCreate: isCreationOffered && !isRestricted,
    isSending: isSurveyFollowUpsAllowed && !isRestricted,
  };
};
