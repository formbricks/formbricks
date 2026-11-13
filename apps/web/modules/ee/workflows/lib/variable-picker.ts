import type { TFunction } from "i18next";
import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import { getIngestedEmbeddedFields } from "@formbricks/types/embedded-data-resolver";
import { type TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type { TSurvey, TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import {
  type TWorkflowDefinition,
  type TWorkflowEmailRecipient,
  type TWorkflowSampleVariables,
  type TWorkflowStepNode,
  type TWorkflowStepNodeOfType,
  type TWorkflowStepType,
  type TWorkflowWebhookTriggerNode,
  WORKFLOW_LIMITS,
  WORKFLOW_TRIGGERS,
  detectWebhookVariables,
  getWorkflowStepType,
  isResponseCompletedTrigger,
  isVariableEmailRecipient,
  isWorkflowVariablePath,
} from "@formbricks/workflows";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { extractCompleteRecallIds, replaceRecallInfoWithUnderline } from "@/lib/utils/recall";
import { getVariableDisplayName } from "@/modules/ee/workflows/lib/variable-name";
import { isRecallExcludedElementType } from "@/modules/survey/components/element-form-input/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import type { TEditorRecallSource } from "@/modules/ui/components/editor/components/recall-source";

/**
 * What the Variable picker (ENG-7113) offers in a step field: the Variables a run will have when it
 * reaches that step, grouped by where they come from — Payload, one group per earlier step, Response
 * (ADR 0045). Pure, so the grouping is tested here and the component only draws it.
 */

/** The hint shown beside a Variable: `boolean` reads "true/false", `empty` is a sample's `null`. */
export type TWorkflowVariableTypeHint = "text" | "number" | "boolean" | "list" | "object" | "empty";

export interface TWorkflowVariableOption {
  /** The prefixed path written into the recall token, e.g. `payload.customer.id`. */
  path: string;
  /** What the picker and the chip show, e.g. `customer.id` or a question's headline. */
  label: string;
  typeHint: TWorkflowVariableTypeHint;
  /**
   * False for a payload or step-output list: shown so the author sees why it is missing, but it
   * can't be picked until loops exist (ENG-7173).
   */
  isPickable: boolean;
  /** Response Variables only: the question type, or `hiddenField`, for the row's icon. */
  iconKey?: TSurveyElementTypeEnum | "hiddenField";
}

export interface TWorkflowPayloadVariableGroup {
  kind: "payload";
  /** False until the workflow has a Sample payload; the picker then says how to get one. */
  hasSample: boolean;
  /** The sample had more paths than were read (`WEBHOOK_VARIABLE_MAX_PATHS`). */
  truncated: boolean;
  options: TWorkflowVariableOption[];
}

export interface TWorkflowStepVariableGroup {
  kind: "step";
  stepId: string;
  stepType: TWorkflowStepType;
  /** The step's own name, when the author gave it one. */
  stepLabel: string | null;
  options: TWorkflowVariableOption[];
}

export interface TWorkflowResponseVariableGroup {
  kind: "response";
  options: TWorkflowVariableOption[];
}

export type TWorkflowVariableGroup =
  | TWorkflowPayloadVariableGroup
  | TWorkflowStepVariableGroup
  | TWorkflowResponseVariableGroup;

/** What a step-type provider may read besides the node, filled in by the editor. */
export interface TWorkflowStepVariableContext {
  /**
   * Example outputs keyed by step id, such as an HTTP request's last test response (ENG-7179), for a
   * step type whose output shape is only known from an example.
   */
  stepSamples: Readonly<Record<string, Record<string, unknown>>>;
}

/** Lists the `steps.<id>.…` Variables a step of one type gives the steps after it. */
export interface TWorkflowStepVariableProvider<T extends TWorkflowStepType> {
  /** The step type's short name in its group heading, e.g. "HTTP" in "HTTP · Get customer tier". */
  getTypeLabel: (t: TFunction) => string;
  getVariables: (
    node: TWorkflowStepNodeOfType<T>,
    context: TWorkflowStepVariableContext
  ) => TWorkflowVariableOption[];
}

export type TWorkflowStepVariableProviders = {
  [T in TWorkflowStepType]: TWorkflowStepVariableProvider<T>;
};

const noVariables = () => [];

/**
 * An HTTP request gives later steps `steps.<id>.status` and `steps.<id>.body…`, and only in "Wait and
 * use it" mode: with "Don't wait" the run moves on before any answer. The status is always there; the
 * body's fields are known from the step's sample, its last Test request response (ENG-7179).
 */
const getHttpRequestVariables: TWorkflowStepVariableProvider<"http_request">["getVariables"] = (
  node,
  { stepSamples }
) => {
  if (node.config.responseMode !== "wait") return [];
  const sample = stepSamples[node.id];
  if (!sample) {
    return [{ path: `steps.${node.id}.status`, label: "status", typeHint: "number", isPickable: true }];
  }
  return getStepOutputOptionsFromSample(node.id, { status: sample.status, body: sample.body });
};

/**
 * One provider per step type, so a new step type fails to compile until it says what later steps
 * can read from it. Send email's output (`messageId`, `provider`) and If/else's branch are
 * bookkeeping, not values to insert.
 */
export const WORKFLOW_STEP_VARIABLE_PROVIDERS: TWorkflowStepVariableProviders = {
  send_email: { getTypeLabel: (t) => t("workspace.workflows.send_email"), getVariables: noVariables },
  if_else: { getTypeLabel: (t) => t("workspace.workflows.if_else"), getVariables: noVariables },
  http_request: {
    getTypeLabel: (t) => t("workspace.workflows.http_request"),
    getVariables: getHttpRequestVariables,
  },
};

export interface TBuildWorkflowVariableGroupsInput {
  definition: TWorkflowDefinition | null;
  /** The step whose field asks for a Variable. */
  nodeId: string;
  /** Variables of the workflow's Sample payload (`GET /api/v3/workflows/{id}/webhook`), if any. */
  sampleVariables: TWorkflowSampleVariables | null;
  /** The survey a Response completed trigger is bound to, when the editor could load it. */
  survey: TSurvey | null;
  /** Defaults to `WORKFLOW_STEP_VARIABLE_PROVIDERS`. */
  stepProviders?: TWorkflowStepVariableProviders;
  stepContext?: TWorkflowStepVariableContext;
}

const SAMPLE_VALUE_TYPE_HINTS = {
  string: "text",
  number: "number",
  boolean: "boolean",
  null: "empty",
} as const satisfies Record<string, TWorkflowVariableTypeHint>;

/**
 * Scalars only, as the trigger panel lists them: an object path is a waypoint, not a value an author
 * puts in a subject or a condition. Lists follow the scalars, unpickable (the sample variables keep
 * them apart, so their document order relative to the scalars is not known).
 */
const getSampleOptions = (
  sampleVariables: TWorkflowSampleVariables,
  toOption: (path: string) => { path: string; label: string }
): TWorkflowVariableOption[] => {
  const options: TWorkflowVariableOption[] = [];
  for (const { path, valueType } of sampleVariables.variables) {
    if (valueType === "object") continue;
    options.push({ ...toOption(path), typeHint: SAMPLE_VALUE_TYPE_HINTS[valueType], isPickable: true });
  }
  for (const { path, reason } of sampleVariables.notSupported) {
    if (reason !== "list") continue;
    options.push({ ...toOption(path), typeHint: "list", isPickable: false });
  }
  return options;
};

const getPayloadOptions = (sampleVariables: TWorkflowSampleVariables): TWorkflowVariableOption[] =>
  getSampleOptions(sampleVariables, (path) => ({ path, label: getVariableDisplayName(path) }));

const PAYLOAD_PREFIX = "payload.";

/**
 * A step's example output as `steps.<stepId>.…` Variables, detected the way a Sample payload is (same
 * path limit, lists flagged), for providers whose output is only known from an example.
 */
export const getStepOutputOptionsFromSample = (
  stepId: string,
  sample: Record<string, unknown>
): TWorkflowVariableOption[] =>
  getSampleOptions(detectWebhookVariables(sample), (payloadPath) => {
    const relative = payloadPath.slice(PAYLOAD_PREFIX.length);
    return { path: `steps.${stepId}.${relative}`, label: relative };
  });

/**
 * The steps that always run before `nodeId`, nearest the trigger first. Branches never join (ADR
 * 0047), so each step has one way in and walking back from it is the whole answer. Bounded by the
 * step limit, so a draft with a cycle still ends.
 */
export const getEarlierWorkflowSteps = (
  definition: TWorkflowDefinition,
  nodeId: string
): TWorkflowStepNode[] => {
  const stepsById = new Map(definition.nodes.map((node) => [node.id, node]));
  const parentById = new Map(definition.edges.map((edge) => [edge.target, edge.source]));
  const earlier: TWorkflowStepNode[] = [];
  const seen = new Set<string>([nodeId]);

  let parentId = parentById.get(nodeId);
  while (parentId !== undefined && !seen.has(parentId) && earlier.length <= WORKFLOW_LIMITS.maxSteps) {
    seen.add(parentId);
    const step = stepsById.get(parentId);
    if (!step) break; // The trigger, or a dangling edge in a draft.
    earlier.push(step);
    parentId = parentById.get(parentId);
  }

  return earlier.reverse();
};

const getStepGroups = (
  definition: TWorkflowDefinition,
  nodeId: string,
  providers: TWorkflowStepVariableProviders,
  context: TWorkflowStepVariableContext
): TWorkflowStepVariableGroup[] =>
  getEarlierWorkflowSteps(definition, nodeId).flatMap((step) => {
    const stepType = getWorkflowStepType(step);
    const provider = providers[stepType] as TWorkflowStepVariableProvider<TWorkflowStepType>;
    const options = provider.getVariables(step as TWorkflowStepNodeOfType<TWorkflowStepType>, context);
    if (options.length === 0) return [];
    return [{ kind: "step" as const, stepId: step.id, stepType, stepLabel: step.label ?? null, options }];
  });

// The language slot workflow emails author against (the survey's default language).
const DEFAULT_LANGUAGE_CODE = "default";

const ELEMENT_TYPE_HINTS: Partial<Record<TSurveyElementTypeEnum, TWorkflowVariableTypeHint>> = {
  [TSurveyElementTypeEnum.Rating]: "number",
  [TSurveyElementTypeEnum.NPS]: "number",
  [TSurveyElementTypeEnum.CSAT]: "number",
  [TSurveyElementTypeEnum.CES]: "number",
  [TSurveyElementTypeEnum.MultipleChoiceMulti]: "list",
  [TSurveyElementTypeEnum.Ranking]: "list",
};

const EMBEDDED_DATA_TYPE_HINTS: Record<TEmbeddedDataType, TWorkflowVariableTypeHint> = {
  string: "text",
  number: "number",
  boolean: "boolean",
  date: "text",
};

const getElementTypeHint = (element: TSurveyElement): TWorkflowVariableTypeHint => {
  if (element.type === TSurveyElementTypeEnum.OpenText && element.inputType === "number") return "number";
  return ELEMENT_TYPE_HINTS[element.type] ?? "text";
};

/**
 * The survey's questions and hidden fields, as the recall picker lists them today: questions whose
 * answer recall can show, then the ingested Embedded Data fields. Both live in `response.data`, which
 * is all a `response.<id>` path reads; computed fields and auto-captured values don't.
 */
const getResponseOptions = (survey: TSurvey): TWorkflowVariableOption[] => {
  const questions = getElementsFromBlocks(survey.blocks)
    .filter((element) => !isRecallExcludedElementType(element))
    .map((element) => ({
      path: `response.${element.id}`,
      label: replaceRecallInfoWithUnderline(
        getTextContent(getLocalizedValue(element.headline, DEFAULT_LANGUAGE_CODE))
      ),
      typeHint: getElementTypeHint(element),
      isPickable: true,
      iconKey: element.type,
    }));
  const hiddenFields = getIngestedEmbeddedFields(survey).map(({ field, link }) => ({
    path: `response.${link.storageKey}`,
    label: field.name || link.storageKey,
    typeHint: EMBEDDED_DATA_TYPE_HINTS[field.dataType],
    isPickable: true,
    iconKey: "hiddenField" as const,
  }));
  return [...questions, ...hiddenFields];
};

const isWebhookTrigger = (
  trigger: TWorkflowDefinition["trigger"] | undefined
): trigger is TWorkflowWebhookTriggerNode => trigger?.triggerType === WORKFLOW_TRIGGERS.WEBHOOK;

const EMPTY_STEP_CONTEXT: TWorkflowStepVariableContext = { stepSamples: {} };

/**
 * The picker's groups for a field of `nodeId`, in order: Payload (Webhook trigger), one group per
 * earlier step that gives Variables, Response (Response completed trigger).
 */
export const buildWorkflowVariableGroups = ({
  definition,
  nodeId,
  sampleVariables,
  survey,
  stepProviders = WORKFLOW_STEP_VARIABLE_PROVIDERS,
  stepContext = EMPTY_STEP_CONTEXT,
}: TBuildWorkflowVariableGroupsInput): TWorkflowVariableGroup[] => {
  const groups: TWorkflowVariableGroup[] = [];

  if (isWebhookTrigger(definition?.trigger)) {
    groups.push({
      kind: "payload",
      hasSample: sampleVariables !== null,
      truncated: sampleVariables?.truncated ?? false,
      options: sampleVariables ? getPayloadOptions(sampleVariables) : [],
    });
  }

  if (definition) {
    groups.push(...getStepGroups(definition, nodeId, stepProviders, stepContext));
  }

  if (isResponseCompletedTrigger(definition?.trigger) && survey) {
    groups.push({ kind: "response", options: getResponseOptions(survey) });
  }

  return groups;
};

/** A Variable's label from the groups; undefined for a path they don't offer. */
export const getWorkflowVariableLabel = (
  groups: readonly TWorkflowVariableGroup[],
  path: string
): string | undefined =>
  groups.flatMap((group) => group.options).find((option) => option.path === path)?.label;

/**
 * Adds Variable chips to another recall source, keeping its items and picker: a Response completed
 * email keeps the survey recall picker, while a `response.<id>` or `steps.…` token written through
 * the API still shows as a chip instead of being dropped from the text.
 */
export const withWorkflowVariableItems = (
  source: TEditorRecallSource,
  groups: readonly TWorkflowVariableGroup[]
): TEditorRecallSource => ({
  getRecallItems: (text) => [...source.getRecallItems(text), ...getWorkflowVariableRecallItems(text, groups)],
  getRecallItemLabel: (id) => source.getRecallItemLabel(id) ?? getWorkflowVariableLabel(groups, id),
  renderPicker: source.renderPicker,
});

/**
 * Which `@` picker a Send email body gets:
 * - `none` when a Variable chooses the recipient: the caller then picks who gets the email, so its
 *   content must be fixed and takes no recall at all (ENG-7169, checked on Enable); also before
 *   there is a trigger.
 * - `survey` for a Response completed trigger: the recall picker it has always had, which also
 *   offers Embedded Data and auto-captured fields a `response.` path can't reach.
 * - `variables` for a Webhook trigger: the Variable picker.
 */
export const getSendEmailBodyRecall = (
  trigger: TWorkflowDefinition["trigger"] | undefined,
  to: TWorkflowEmailRecipient
): "none" | "survey" | "variables" => {
  if (isVariableEmailRecipient(to)) return "none";
  if (isResponseCompletedTrigger(trigger)) return "survey";
  if (isWebhookTrigger(trigger)) return "variables";
  return "none";
};

export type TWorkflowVariableListOption = TWorkflowVariableOption & {
  /** Position in the keyboard order across all groups; null for a row that can't be picked. */
  index: number | null;
};

type TWithListOptions<TGroup> = TGroup extends TWorkflowVariableGroup
  ? Omit<TGroup, "options"> & { options: TWorkflowVariableListOption[] }
  : never;

export type TWorkflowVariableListGroup = TWithListOptions<TWorkflowVariableGroup>;

export interface TWorkflowVariableList {
  groups: TWorkflowVariableListGroup[];
  pickableCount: number;
}

/**
 * The groups as the picker draws them for a search: rows whose label or path contains the query
 * (case-insensitive), groups left empty dropped, and pickable rows numbered continuously across
 * groups, since arrow keys walk the whole list by that number.
 */
export const filterWorkflowVariableGroups = (
  groups: readonly TWorkflowVariableGroup[],
  search: string
): TWorkflowVariableList => {
  const query = search.trim().toLowerCase();
  const matches = (option: TWorkflowVariableOption) =>
    query === "" || option.label.toLowerCase().includes(query) || option.path.toLowerCase().includes(query);

  let pickableCount = 0;
  const listed: TWorkflowVariableListGroup[] = [];
  for (const group of groups) {
    const options = group.options.filter(matches).map((option) => ({
      ...option,
      index: option.isPickable ? pickableCount++ : null,
    }));
    if (options.length > 0) listed.push({ ...group, options } as TWorkflowVariableListGroup);
  }
  return { groups: listed, pickableCount };
};

/**
 * The recall items for the Variable tokens complete in a text, so the editor shows them as chips.
 * A path the picker no longer offers (the sample changed, a step went away) still gets a chip named
 * after its path: the token stays in the text, and an editor that can't label a token drops it.
 * Bare-id tokens are survey answers, left to survey recall.
 */
export const getWorkflowVariableRecallItems = (
  text: string,
  groups: readonly TWorkflowVariableGroup[]
): TSurveyRecallItem[] => {
  if (!text.includes("#recall:")) return [];
  const labels = new Map(
    groups.flatMap((group) => group.options.map((option) => [option.path, option.label] as const))
  );
  return extractCompleteRecallIds(text)
    .filter((id) => isWorkflowVariablePath(id))
    .map((path) => ({
      id: path,
      label: labels.get(path) ?? getVariableDisplayName(path),
      type: "variable" as const,
    }));
};
