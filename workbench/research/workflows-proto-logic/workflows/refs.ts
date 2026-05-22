import type { TriggerType } from "./schema";
import { resolveRef } from "./trigger-output";

const TEMPLATE_REF = /\{\{\s*([^}]+?)\s*\}\}/g;

export function collectRefs(value: string): string[] {
  const out: string[] = [];
  for (const match of value.matchAll(TEMPLATE_REF)) {
    out.push(match[1]!.trim());
  }
  return out;
}

export function findInvalidRefs(value: string, triggerType: TriggerType | null): string[] {
  return collectRefs(value).filter((ref) => !resolveRef(triggerType, ref));
}

export function wrapRef(path: string): string {
  return `{{${path}}}`;
}
