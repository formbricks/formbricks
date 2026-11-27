import { describe, expect, test } from "vitest";
import { ZCreateWorkflowInput } from "@formbricks/workflows";
import { ZMcpCreateWorkflowInput, ZMcpPatchWorkflowInput } from "./workflow-schemas";

const definition = {
  schemaVersion: 1,
  trigger: {
    id: "trigger",
    type: "trigger",
    triggerType: "response.completed",
    config: { surveyId: "cm9zr4q7i000108l84gozfggr", endingCardIds: [] },
  },
  nodes: [
    {
      id: "send-email",
      type: "action",
      actionType: "send_email",
      config: {
        from: "noreply@example.com",
        to: "support@example.com",
        replyTo: ["support@example.com"],
        subject: "Thanks",
        body: "Thanks for your response.",
        attachResponseData: true,
      },
    },
  ],
  edges: [{ id: "e1", source: "trigger", target: "send-email" }],
  entryNodeId: "trigger",
};

// `sendTo` is a misspelling of `to`; the real `to` stays, so the extra key is the only thing wrong.
const misspelled = {
  ...definition,
  nodes: [{ ...definition.nodes[0], config: { ...definition.nodes[0].config, sendTo: "ops@example.com" } }],
};

const createInput = (workflowDefinition: unknown) => ({
  workspaceId: "cm9zr4mps000008l8btfy1vtz",
  name: "Notify team",
  definition: workflowDefinition,
});
const patchInput = (workflowDefinition: unknown) => ({
  workflowId: "wf1234567890123456789012ab",
  data: { definition: workflowDefinition },
});

describe("unknown keys inside a workflow definition (ENG-2437)", () => {
  test.each([
    ["create_workflow", ZMcpCreateWorkflowInput, createInput],
    ["patch_workflow", ZMcpPatchWorkflowInput, patchInput],
  ] as const)(
    "%s refuses the call through the SDK's validate and names the key",
    async (_tool, schema, input) => {
      // The same call without the misspelled key is accepted, so the key is the only reason for the refusal.
      expect((await schema["~standard"].validate(input(definition))).issues).toBeUndefined();

      const result = await schema["~standard"].validate(input(misspelled));

      expect(result.issues).toBeDefined();
      expect(JSON.stringify(result.issues)).toContain(String.raw`Unrecognized key: \"sendTo\"`);
    }
  );

  test("the v3 REST contract still drops the key, as before", () => {
    const parsed = ZCreateWorkflowInput.safeParse(createInput(misspelled));

    expect(parsed.success).toBe(true);
    expect(parsed.data?.definition.nodes[0].config).not.toHaveProperty("sendTo");
  });
});
