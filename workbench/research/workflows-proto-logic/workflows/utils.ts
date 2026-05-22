import type { Workflow } from "./schema";

export function createBlankWorkflow(input: { ownerId: string }): Workflow {
  return {
    id: crypto.randomUUID(),
    name: "Untitled workflow",
    status: "draft",
    trigger: null,
    conditions: [],
    actions: [],
    ownerId: input.ownerId,
    updatedAt: new Date().toISOString(),
  };
}
