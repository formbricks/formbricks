import { z } from "zod";
import { listActionDescriptors } from "./actions-registry";
import { OperatorSchema, TriggerSchema, type TriggerType } from "./schema";
import { type LeafType, operatorsFor, triggerOutputs } from "./trigger-output";

// JSON snapshot of what we will feed to the AI
export type AiManifest = {
  triggers: Array<{ type: TriggerType; requiredParams: string[] }>;
  triggerOutputs: Record<TriggerType, Array<{ path: string; label: string; type: LeafType }>>;
  operators: {
    all: string[];
    byLeafType: Record<LeafType, string[]>;
  };
  actions: Array<{
    integration: string;
    operation: string;
    label: string;
    category: string;
    configSchema: unknown;
    fields: Array<{
      key: string;
      label: string;
      kind: "text" | "textarea";
      required: boolean;
      acceptsDataRefs: boolean;
      help?: string;
      placeholder?: string;
    }>;
  }>;
  refSyntax: string;
};

function triggersFromSchema(): AiManifest["triggers"] {
  return TriggerSchema.options.map((option) => {
    const shape = option.shape as Record<string, z.ZodType>;
    const type = (shape.type as z.ZodLiteral<TriggerType>).value;
    const requiredParams = Object.keys(shape).filter((key) => key !== "type");
    return { type, requiredParams };
  });
}

const LEAF_TYPES: LeafType[] = ["string", "number", "boolean", "datetime", "unknown"];

export function buildAiManifest(): AiManifest {
  const byLeafType = Object.fromEntries(LEAF_TYPES.map((leaf) => [leaf, operatorsFor(leaf)])) as Record<
    LeafType,
    string[]
  >;

  return {
    triggers: triggersFromSchema(),
    triggerOutputs,
    operators: {
      all: [...OperatorSchema.options],
      byLeafType,
    },
    actions: listActionDescriptors().map((descriptor) => ({
      integration: descriptor.integration,
      operation: descriptor.operation,
      label: descriptor.label,
      category: descriptor.category,
      configSchema: z.toJSONSchema(descriptor.configSchema),
      fields: descriptor.fields.map((field) => ({
        key: field.key,
        label: field.label,
        kind: field.kind,
        required: Boolean(field.required),
        acceptsDataRefs: Boolean(field.acceptsDataRefs),
        help: field.help,
        placeholder: field.placeholder,
      })),
    })),
    refSyntax: [
      "Use {{path}} templating inside string fields that accept data refs",
      '(e.g. "Hello {{response.email}}"). Only use paths listed in triggerOutputs for the selected trigger.',
    ].join(" "),
  };
}

export function buildSystemPrompt(manifest: AiManifest): string {
  return [
    "You are a workflow authoring assistant for Formbricks.",
    "Given a natural-language description, return a JSON object matching the WorkflowDraft schema: { name, trigger, conditions, actions }.",
    "",
    "Hard rules:",
    "- Output must strictly match the provided schema. No extra fields.",
    '- "name" must be a concise, human-friendly title (max 120 chars).',
    '- Use only triggers listed in `triggers`. Fill in their required params sensibly; if the user did not specify, use a placeholder like "REPLACE_ME" so the human can edit it in the UI.',
    "- Condition `left.$ref` MUST be a path from `triggerOutputs` for the chosen trigger type.",
    "- Use operators from `operators.byLeafType` matching the referenced path type. For `isSet` / `isEmpty`, omit `right`. Otherwise set `right` to a string, number, or boolean.",
    '- Each condition needs a unique `id` (short slug like "c_nps_gte_8").',
    "- Use only actions listed in `actions`. Their `config` must validate against the corresponding `configSchema`.",
    '- Each action needs a unique `id` (short slug like "a_slack_1").',
    "- String fields with `acceptsDataRefs: true` MAY interpolate trigger outputs via `{{path}}` templating — only paths from `triggerOutputs` for the chosen trigger.",
    "- Prefer minimal, correct workflows over speculative extras.",
    "",
    "Capability manifest:",
    JSON.stringify(manifest, null, 2),
  ].join("\n");
}
