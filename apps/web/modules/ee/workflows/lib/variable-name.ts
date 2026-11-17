/** Labels for Variable paths the editor knows a human name for, e.g. a question's headline. */
export type TVariableLabels = ReadonlyMap<string, string>;

const PAYLOAD_PREFIX = "payload.";
// `steps.<step id>.<field>`: the step id is a generated id nobody reads; the field is what the picker shows.
const STEP_PATH = /^steps\.[^.]+\.(.+)$/;

/**
 * How the editor names a Variable: by its label when one is known (a survey question's headline for
 * `response.<questionId>`, a step's name and field on the canvas), else the way the @ picker lists it:
 * payload Variables by their key (`customer.id`), a step's output by its field (`body.json.club`), never
 * by the step's id. An unlabelled `response.…` keeps its prefix so it stays recognisable.
 */
export const getVariableDisplayName = (path: string, labels?: TVariableLabels): string => {
  const label = labels?.get(path);
  if (label !== undefined) return label;
  if (path.startsWith(PAYLOAD_PREFIX)) return path.slice(PAYLOAD_PREFIX.length);
  return STEP_PATH.exec(path)?.[1] ?? path;
};
