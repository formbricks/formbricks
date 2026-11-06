/**
 * The survey schema prefixes every rule error with "Conditional Logic:", the name of the Questions
 * tab section rules lived in before the Flow tab. The editor's toast names the tab they live in now.
 * Rewritten where the toast is built rather than in the schema, whose messages the API returns too.
 */
const CONDITIONAL_LOGIC_PREFIX = /^Conditional Logic:\s*/;

export const toFlowTabMessage = (message: string, flowTabName: string): string =>
  message.replace(CONDITIONAL_LOGIC_PREFIX, `${flowTabName}: `);
