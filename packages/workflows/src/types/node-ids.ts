import { REFUSED_WORKFLOW_PATH_SEGMENTS, WORKFLOW_PATH_SEGMENT_PATTERN_SOURCE } from "../variables/paths";
import { WORKFLOW_SAMPLE_TRIGGER_SOURCE } from "./samples";

/** Longest node id a definition may be saved with. The editor's ids (cuid2) are 24 characters. */
export const MAX_WORKFLOW_NODE_ID_LENGTH = 64;

/**
 * Step ids starting with this are refused: the Webhook trigger's samples live under `trigger` and
 * `trigger_*` sources (`trigger_last_call`), in the same column as an HTTP request step's expected
 * response, which is stored under the step's own id. Reserving the prefix keeps room for later
 * trigger sources without another rule.
 */
export const WORKFLOW_RESERVED_STEP_ID_PREFIX = `${WORKFLOW_SAMPLE_TRIGGER_SOURCE}_`;

const NODE_ID_PATTERN = new RegExp(`^${WORKFLOW_PATH_SEGMENT_PATTERN_SOURCE}$`);

/**
 * Why a node id can't be saved, or null. Every node id (the trigger's and each step's) uses only
 * letters, digits, `_` and `-`, at most `MAX_WORKFLOW_NODE_ID_LENGTH` characters: a step id is a
 * segment of `steps.<id>` Variable paths, part of a BullMQ job id (which can't contain `:`), and the
 * sample source of an HTTP request step (whose last Test request response is `<id>:last_test`).
 *
 * A step's id also can't be a name the workflow already uses for something else: `trigger` or a
 * `trigger_` prefix (the Webhook trigger's sample sources, `WORKFLOW_TRIGGER_SAMPLE_SOURCES`), or a
 * segment Variable paths refuse (`__proto__`, `prototype`, `constructor`). The trigger itself may be
 * called `trigger`: its id is never a sample source.
 *
 * Checked on save and enable only (`validateWorkflowDefinitionSaveRules`): definitions stored before
 * the rule still load and run.
 */
export const getWorkflowNodeIdProblem = (id: string, kind: "trigger" | "step"): string | null => {
  if (id.length > MAX_WORKFLOW_NODE_ID_LENGTH) {
    return `A node id can be at most ${MAX_WORKFLOW_NODE_ID_LENGTH} characters`;
  }
  if (!NODE_ID_PATTERN.test(id)) {
    return `Node id ${id} can only contain letters, digits, _ and -`;
  }
  if (kind === "trigger") return null;
  if (id === WORKFLOW_SAMPLE_TRIGGER_SOURCE || id.startsWith(WORKFLOW_RESERVED_STEP_ID_PREFIX)) {
    return `Step id ${id} is reserved: a step id can't be ${WORKFLOW_SAMPLE_TRIGGER_SOURCE} or start with ${WORKFLOW_RESERVED_STEP_ID_PREFIX}`;
  }
  if (REFUSED_WORKFLOW_PATH_SEGMENTS.has(id)) {
    return `Step id ${id} is reserved`;
  }
  return null;
};
