import { describe, expect, test } from "vitest";
import { z } from "zod";
import * as surveyAndFeedbackSchemas from "./schemas";
import * as workflowSchemas from "./workflow-schemas";

/**
 * Guards the ENG-2256 policy at every depth, against the JSON Schema we actually advertise rather than
 * against the Zod source — the two can disagree, and the advertised copy is what the SDK validates.
 *
 * The per-schema tests elsewhere in this directory prove that *a* strict schema rejects *an* unknown key.
 * They cannot prove the policy holds everywhere, and twice now it has not: the first version of the strict
 * change left every nested `filter` object open, and the version after that still left the whole workflow
 * `definition` subtree open. Both were found by reading, not by a failing test. This closes that gap: a
 * structured object added without strictness fails here, wherever in the tree it sits.
 *
 * Three states are distinguished, because only one of them is a bug:
 *   - `additionalProperties: false` — strict. What every structured object should be.
 *   - `additionalProperties` present as `true`/a schema — a deliberate `z.record` free-form field
 *     (`metadata`, `blocks`, `welcomeCard`, the `data` payloads). Validated downstream by the v3 document
 *     contract, so unknown keys there are the point rather than a mistake.
 *   - `additionalProperties` absent — an open structured object. The bug.
 */
function collectObjectNodes(node: unknown, path: string, open: string[], freeForm: string[]): void {
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;

  if (record.type === "object" || record.properties) {
    if (record.additionalProperties === false) {
      // strict — nothing to record
    } else if (record.additionalProperties === undefined) {
      open.push(path);
    } else {
      freeForm.push(path);
    }
  }

  for (const [key, value] of Object.entries(record)) {
    // `$defs` holds schemas reached by `$ref`, so they have to be walked as roots of their own or the
    // nodes only reachable through a `$ref` are never checked (which is how the if/else condition group
    // went unnoticed).
    if (key === "properties" || key === "$defs") {
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        collectObjectNodes(childValue, `${path}.${childKey}`, open, freeForm);
      }
    } else if (key === "items") {
      collectObjectNodes(value, `${path}[]`, open, freeForm);
    } else if (key === "additionalProperties") {
      collectObjectNodes(value, `${path}{}`, open, freeForm);
    } else if (key === "anyOf" || key === "allOf" || key === "oneOf") {
      (value as unknown[]).forEach((member, index) =>
        collectObjectNodes(member, `${path}|${index}`, open, freeForm)
      );
    }
  }
}

function openObjectPaths(name: string, schema: z.ZodType): string[] {
  const open: string[] = [];
  const freeForm: string[] = [];
  // `io: "input"` matches how the tool schemas are advertised — the same conversion the SDK performs.
  collectObjectNodes(z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }), name, open, freeForm);
  return open;
}

const allSchemas = Object.entries({ ...surveyAndFeedbackSchemas, ...workflowSchemas }).filter(
  (entry): entry is [string, z.ZodType] => entry[1] instanceof z.ZodType
);

/**
 * The two tools whose input embeds the shared workflow `definition`, which is still open at every level
 * below `definition` itself.
 *
 * Not fixable at this layer: `ZWorkflowDefinition` lives in `packages/workflows` and is parsed by the v3
 * Workflows REST route and posted by the workflow builder, so making it strict is a v3 API change with its
 * own blast radius rather than part of an MCP migration. Tracked as ENG-2437; when that lands, delete this
 * list and the test below it — the general case above then covers these two as well.
 */
const SCHEMAS_WITH_OPEN_WORKFLOW_DEFINITION = ["ZMcpCreateWorkflowInput", "ZMcpPatchWorkflowInput"];

describe("MCP tool input schemas reject undeclared arguments (ENG-2256)", () => {
  test.each(allSchemas.filter(([name]) => !SCHEMAS_WITH_OPEN_WORKFLOW_DEFINITION.includes(name)))(
    "%s has no open structured object at any depth",
    (_name, schema) => {
      expect(openObjectPaths(_name, schema)).toEqual([]);
    }
  );

  test.each(allSchemas.filter(([name]) => SCHEMAS_WITH_OPEN_WORKFLOW_DEFINITION.includes(name)))(
    "%s is open only inside the shared workflow definition",
    (_name, schema) => {
      const open = openObjectPaths(_name, schema);

      // The known gap is bounded: it must stay confined to the `definition` subtree (or a `$defs` entry,
      // which exists only because a definition sub-schema is referenced twice). A new open object on a
      // *top-level* tool argument is a new bug and fails here.
      const outsideDefinition = open.filter(
        (path) => !path.includes(".definition") && !path.includes(".__schema")
      );

      expect(outsideDefinition).toEqual([]);
      // Guards the premise of the exclusion itself: if this ever empties, the shared definition became
      // strict and both this test and the exclusion list above should be deleted.
      expect(open.length).toBeGreaterThan(0);
    }
  );

  test("advertises strictness as additionalProperties: false, not merely as a Zod flag", () => {
    // The failure mode this rules out: strictness that exists in Zod but is lost in the JSON Schema the
    // client reads, which would leave every client believing extra keys are welcome.
    const advertised = z.toJSONSchema(surveyAndFeedbackSchemas.ZMcpListSurveysInput, { io: "input" });

    expect(advertised).toMatchObject({ additionalProperties: false });
  });
});
