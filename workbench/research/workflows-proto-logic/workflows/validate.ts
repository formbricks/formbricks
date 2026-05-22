import { findActionDescriptor } from "./actions-registry";
import { collectRefs } from "./refs";
import type { Workflow } from "./schema";
import { operatorsFor, resolveRef } from "./trigger-output";

export type Issue = {
  path: string;
  message: string;
};

export function validate(workflow: Workflow): Issue[] {
  const issues: Issue[] = [];

  if (!workflow.trigger) {
    issues.push({ path: "trigger", message: "Pick a trigger to start this workflow." });
  } else if (workflow.trigger.type === "survey.response.created" && workflow.trigger.surveyId.trim() === "") {
    issues.push({ path: "trigger.surveyId", message: "Survey ID is required." });
  }

  const triggerType = workflow.trigger?.type ?? null;

  workflow.conditions.forEach((condition, index) => {
    const path = `conditions[${index}]`;
    const leafType = resolveRef(triggerType, condition.left.$ref);
    if (!leafType) {
      issues.push({
        path: `${path}.left`,
        message: `"${condition.left.$ref}" is not available on this trigger.`,
      });
      return;
    }
    const allowed = operatorsFor(leafType);
    if (!allowed.includes(condition.operator)) {
      issues.push({
        path: `${path}.operator`,
        message: `Operator "${condition.operator}" does not apply to ${leafType} values.`,
      });
    }
    const needsRight = condition.operator !== "isSet" && condition.operator !== "isEmpty";
    if (needsRight && condition.right === undefined) {
      issues.push({
        path: `${path}.right`,
        message: "This operator needs a value to compare against.",
      });
    }
  });

  workflow.actions.forEach((action, index) => {
    const path = `actions[${index}]`;
    const descriptor = findActionDescriptor(action.integration, action.operation);
    if (!descriptor) {
      issues.push({
        path,
        message: `Unknown action "${action.integration}.${action.operation}".`,
      });
      return;
    }

    const parsed = descriptor.configSchema.safeParse(action.config);
    if (!parsed.success) {
      for (const zodIssue of parsed.error.issues) {
        issues.push({
          path: `${path}.config.${zodIssue.path.join(".")}`,
          message: zodIssue.message,
        });
      }
    }

    for (const field of descriptor.fields) {
      if (!field.acceptsDataRefs) continue;
      const raw = action.config[field.key];
      if (typeof raw !== "string") continue;
      for (const ref of collectRefs(raw)) {
        if (!resolveRef(triggerType, ref)) {
          issues.push({
            path: `${path}.config.${field.key}`,
            message: `"{{${ref}}}" is not available on this trigger.`,
          });
        }
      }
    }
  });

  return issues;
}

export function canEnable(workflow: Workflow): boolean {
  return validate(workflow).length === 0;
}
