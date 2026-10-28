/**
 * The message "Ask for a change" posts into the chat as the person's own turn. It names the survey by
 * id so the agent can act without asking which one, and quotes the question the person picked so it is
 * unambiguous after later edits renumber the survey. The person's words go last and untouched.
 */
export const buildChangeRequest = ({
  surveyId,
  surveyName,
  target,
  request,
}: {
  surveyId: string;
  surveyName: string;
  target: { number: number; headline: string } | null;
  request: string;
}): string => {
  const about = target
    ? `question ${target.number}${target.headline ? ` ("${target.headline}")` : ""}`
    : "the survey as a whole";
  return `Change the survey "${surveyName}" (id ${surveyId}), about ${about}: ${request.trim()}`;
};
