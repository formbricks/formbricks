/** Labels for Variable paths the editor knows a human name for, e.g. a question's headline. */
export type TVariableLabels = ReadonlyMap<string, string>;

/**
 * How the editor names a Variable: by its label when one is known (a survey question's headline for
 * `response.<questionId>`), else payload Variables by their key (`customer.id`), the way the @ picker
 * lists them; `steps.…` and unlabelled `response.…` keep their prefix so they stay recognisable.
 */
export const getVariableDisplayName = (path: string, labels?: TVariableLabels) =>
  labels?.get(path) ?? path.replace(/^payload\./, "");
