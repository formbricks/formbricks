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
 *   - `additionalProperties` present as `true`/a schema — a `z.record` free-form field. Legitimate, but only
 *     for the fields listed in `EXPECTED_FREE_FORM_PATHS`: turning a structured object free-form is just as
 *     much a hole as leaving it open, so the set is pinned rather than waved through by shape alone.
 *   - `additionalProperties` absent — an open structured object. The bug.
 */

/** Marks a path as living in `$defs`, i.e. reachable only through whatever `$ref`s it. */
const DEFS_PREFIX = "$defs:";

interface Walked {
  /** Object nodes with no unknown-keys policy at all. The bug. */
  open: string[];
  /** Object nodes advertising `additionalProperties: true`/a schema — a `z.record`, legitimate if listed. */
  freeForm: string[];
  /** Where each `$defs` entry is referenced from, so a hoisted node's real reachability can be checked. */
  refs: { def: string; at: string }[];
}

/**
 * Recurses into every value rather than an allowlist of JSON Schema keywords.
 *
 * Deliberate: a keyword-driven walker is only as complete as the keyword list, and the first version of
 * this file proved the point by missing `$defs` — which is where a `$ref`'d sub-schema lives, and so where
 * the workflow if/else condition group was hiding. Anything the generator emits now or later (`if`/`then`/
 * `else`, `prefixItems`, `unevaluatedProperties`) is walked without this needing to know about it. Keys that
 * carry no schema (`required`, `type`, `description`) hold strings, so recursing into them finds nothing.
 */
function collectObjectNodes(node: unknown, path: string, walked: Walked): void {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    node.forEach((member, index) => collectObjectNodes(member, `${path}|${index}`, walked));
    return;
  }

  const schema = node as Record<string, unknown>;

  if (typeof schema.$ref === "string") {
    walked.refs.push({ def: schema.$ref.replace("#/$defs/", ""), at: path });
  }

  if (schema.type === "object" || schema.properties) {
    if (schema.additionalProperties === undefined) {
      walked.open.push(path);
    } else if (schema.additionalProperties !== false) {
      walked.freeForm.push(path);
    }
  }

  for (const [key, value] of Object.entries(schema)) {
    if (key === "properties") {
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        collectObjectNodes(childValue, `${path}.${childKey}`, walked);
      }
    } else if (key === "$defs") {
      // Keyed by definition name, not by this path: a `$defs` entry is not reachable *here*, it is reachable
      // wherever something `$ref`s it. `walked.refs` is what recovers that, so an exclusion can be checked
      // against where the node really sits instead of waving every hoisted node through.
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        collectObjectNodes(childValue, `${DEFS_PREFIX}${childKey}`, walked);
      }
    } else if (key === "items") {
      collectObjectNodes(value, `${path}[]`, walked);
    } else if (key === "additionalProperties") {
      collectObjectNodes(value, `${path}{}`, walked);
    } else {
      collectObjectNodes(value, `${path}.${key}`, walked);
    }
  }
}

function classifyObjectNodes(name: string, schema: z.ZodType): Walked {
  const walked: Walked = { open: [], freeForm: [], refs: [] };
  const json = z.toJSONSchema(schema, {
    // `io: "input"` matches how the tool schemas are advertised — the same conversion the SDK performs.
    io: "input",
    unrepresentable: "any",
    // Inline plain reuse instead of hoisting it into `$defs`, so a sub-schema that merely appears twice
    // still reports the path it is reachable from. It does NOT eliminate `$defs`: a *recursive* schema has
    // to be a `$ref` whatever this is set to, and the workflow if/else condition group is exactly that — so
    // one hoisted entry survives and the workflow test below has to check where it is referenced from
    // rather than excusing `$defs` wholesale. This setting shrinks that problem to the recursive case; it
    // does not remove it.
    reused: "inline",
  });
  collectObjectNodes(json, name, walked);
  return walked;
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

/**
 * Every field that may legitimately accept an arbitrary nested shape: the survey/workflow document payloads
 * and record metadata, all validated downstream by the v3 document contract. Pinned so that making a
 * structured object free-form is a deliberate edit here rather than a silent widening.
 */
const EXPECTED_FREE_FORM_PATHS: Record<string, string[]> = {
  ZMcpCreateSurveyInput: [
    "ZMcpCreateSurveyInput.metadata",
    // `languages[]` is deliberately absent: it is `ZMcpSurveyLanguageInput`, a strict object, not a payload.
    "ZMcpCreateSurveyInput.welcomeCard",
    "ZMcpCreateSurveyInput.blocks[]",
    "ZMcpCreateSurveyInput.endings[]",
    "ZMcpCreateSurveyInput.hiddenFields",
    "ZMcpCreateSurveyInput.variables[]",
  ],
  ZMcpPatchSurveyInput: ["ZMcpPatchSurveyInput.data"],
  ZMcpValidateSurveyInput: ["ZMcpValidateSurveyInput.data"],
  ZMcpCreateFeedbackRecordInput: ["ZMcpCreateFeedbackRecordInput.metadata"],
  ZMcpCreateFeedbackRecordsInput: ["ZMcpCreateFeedbackRecordsInput.records[].metadata"],
  ZMcpUpdateFeedbackRecordInput: ["ZMcpUpdateFeedbackRecordInput.metadata"],
};

describe("MCP tool input schemas reject undeclared arguments (ENG-2256)", () => {
  const generalCase = allSchemas.filter(([name]) => !SCHEMAS_WITH_OPEN_WORKFLOW_DEFINITION.includes(name));

  test.each(generalCase)("%s has no open structured object at any depth", (name, schema) => {
    expect(classifyObjectNodes(name, schema).open).toEqual([]);
  });

  test.each(generalCase)("%s widens only where a free-form payload is expected", (name, schema) => {
    expect(classifyObjectNodes(name, schema).freeForm.sort()).toEqual(
      (EXPECTED_FREE_FORM_PATHS[name] ?? []).slice().sort()
    );
  });

  test.each(allSchemas.filter(([name]) => SCHEMAS_WITH_OPEN_WORKFLOW_DEFINITION.includes(name)))(
    "%s is open only inside the shared workflow definition",
    (name, schema) => {
      const { open, refs } = classifyObjectNodes(name, schema);

      /**
       * A `$defs` entry is only excusable if every reference to it sits inside `definition`. `reused:
       * "inline"` above removes plain reuse from `$defs`, but a *recursive* schema still has to be a `$ref`
       * — that is what the workflow if/else condition group is — so one hoisted entry survives and needs
       * checking rather than waving through. Excluding `$defs` unconditionally would hide a future open node
       * that is reachable from a top-level argument, since `$defs` is where the emitter puts anything
       * referenced twice, definition-related or not.
       */
      const reachedOnlyViaDefinition = (path: string): boolean => {
        if (!path.startsWith(DEFS_PREFIX)) return false;
        const def = path.slice(DEFS_PREFIX.length).split(/[.[|{]/)[0];
        const referencedFrom = refs.filter((ref) => ref.def === def).map((ref) => ref.at);

        return (
          referencedFrom.length > 0 &&
          referencedFrom.every((at) => at.includes(".definition") || at.startsWith(DEFS_PREFIX))
        );
      };

      // The known gap is bounded: it must stay confined to the `definition` subtree. A new open object on a
      // *top-level* tool argument is a new bug and fails here.
      const outsideDefinition = open.filter(
        (path) => !path.includes(".definition") && !reachedOnlyViaDefinition(path)
      );

      expect(outsideDefinition).toEqual([]);
      // Guards the premise of the exclusion itself: when the shared definition becomes strict this empties,
      // and both this test and the exclusion list above should be deleted. Counted inside the `definition`
      // subtree specifically — a bare `open.length` could be held above zero by an unrelated open node
      // elsewhere, and would quietly stop being a tripwire.
      expect(open.filter((path) => path.includes(".definition"))).not.toEqual([]);
    }
  );

  test("advertises strictness as additionalProperties: false, not merely as a Zod flag", () => {
    // The failure mode this rules out: strictness that exists in Zod but is lost in the JSON Schema the
    // client reads, which would leave every client believing extra keys are welcome.
    const advertised = z.toJSONSchema(surveyAndFeedbackSchemas.ZMcpListSurveysInput, { io: "input" });

    expect(advertised).toMatchObject({ additionalProperties: false });
  });
});
