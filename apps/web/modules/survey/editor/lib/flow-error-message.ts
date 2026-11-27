/**
 * The survey schema prefixes every rule error with "Conditional Logic:", the name of the Questions
 * tab section rules lived in before the Flow tab. The editor's toast names the tab they live in now.
 * Rewritten where the toast is built rather than in the schema, whose messages the API returns too.
 */
const CONDITIONAL_LOGIC_PREFIX = /^Conditional Logic:\s*/;

export const toFlowTabMessage = (message: string, flowTabName: string): string =>
  message.replace(CONDITIONAL_LOGIC_PREFIX, `${flowTabName}: `);

/** Whether the schema wrote this message about conditional logic, which is edited on the Flow tab. */
export const isConditionalLogicMessage = (message: string): boolean => CONDITIONAL_LOGIC_PREFIX.test(message);

/** The message without the "Conditional Logic:" prefix, for a place that already says it is about the flow. */
export const withoutFlowPrefix = (message: string): string => {
  const rest = message.replace(CONDITIONAL_LOGIC_PREFIX, "");
  return rest.charAt(0).toUpperCase() + rest.slice(1);
};
