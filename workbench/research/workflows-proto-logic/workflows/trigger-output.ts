import type { TriggerType } from "./schema";

// This file defines the data contract a downstream step can bind to, per trigger type.

export type LeafType = "string" | "number" | "boolean" | "datetime" | "unknown";

export type TriggerOutputLeaf = {
  path: string;
  label: string;
  type: LeafType;
};

export const triggerOutputs: Record<TriggerType, TriggerOutputLeaf[]> = {
  "survey.response.created": [
    { path: "response.id", label: "Response ID", type: "string" },
    { path: "response.email", label: "Respondent email", type: "string" },
    { path: "response.createdAt", label: "Response timestamp", type: "datetime" },
    { path: "survey.id", label: "Survey ID", type: "string" },
    { path: "survey.name", label: "Survey name", type: "string" },
    { path: "answers.nps", label: "NPS answer", type: "number" },
    { path: "answers.comment", label: "Comment answer", type: "string" },
  ],
};

export function listOutputLeaves(triggerType: TriggerType | null | undefined): TriggerOutputLeaf[] {
  if (!triggerType) return [];
  return triggerOutputs[triggerType] ?? [];
}

export function resolveRef(triggerType: TriggerType | null | undefined, ref: string): LeafType | null {
  if (!triggerType) return null;
  const leaves = triggerOutputs[triggerType] ?? [];
  const direct = leaves.find((leaf) => leaf.path === ref);
  if (direct) return direct.type;
  if (ref.startsWith("answers.")) return "unknown";
  return null;
}

export function operatorsFor(leafType: LeafType): string[] {
  switch (leafType) {
    case "number":
      return ["eq", "neq", "gt", "gte", "lt", "lte", "isSet", "isEmpty"];
    case "string":
      return ["eq", "neq", "contains", "isSet", "isEmpty"];
    case "boolean":
      return ["eq", "neq", "isSet", "isEmpty"];
    case "datetime":
      return ["eq", "neq", "gt", "gte", "lt", "lte", "isSet", "isEmpty"];
    case "unknown":
      return ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "isSet", "isEmpty"];
  }
}
