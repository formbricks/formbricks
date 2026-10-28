import { type TWorkflowDocument, type TWorkflowResource, ZWorkflowDocument } from "@formbricks/workflows";
import type { WorkflowEditableState } from "@formbricks/workflows/server";
import { formatZodIssues } from "@/app/api/v3/lib/api-wrapper";
import type { InvalidParam } from "@/app/api/v3/lib/response";

/**
 * A workflow as a pull/push document (ADR 0015): its editable state and nothing the server owns. The schema
 * is the package's (`ZWorkflowDocument`, built from the create input so it accepts exactly what a create
 * accepts); see there for what is left out. The top level is strict, so a key that is not a field is
 * refused, naming it. Below it the definition schema is not strict, which `parseWorkflowDocument` makes up.
 *
 * A push replaces: `description` omitted resets to none, and inside the definition `nodes`, `edges` and
 * `schemaVersion` fall back to what a create without them stores. `name` and `definition` have no default
 * and are required.
 */
export const ZV3WorkflowDocument = ZWorkflowDocument;
export type TV3WorkflowDocument = TWorkflowDocument;

/** The document of a stored workflow, every field present. */
export const toWorkflowDocument = ({
  name,
  description,
  definition,
}: Pick<TWorkflowResource, "name" | "description" | "definition">): Record<string, unknown> => ({
  name,
  description,
  definition,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Where `output` has lost something `input` carried. The shared definition schema is not strict below the
 * top level, so parsing silently drops a misspelled or unknown key (`cofnig`, an invented option), and a
 * push that drops it would store something other than what the agent sent without saying so. Parsing
 * stays the one source of truth for what is valid; this only compares its result with what went in.
 * Values the schema fills in (defaults) are additions, never reported.
 */
export const findDroppedKeys = (input: unknown, output: unknown, path: string[] = []): InvalidParam[] => {
  if (Array.isArray(input) && Array.isArray(output)) {
    const dropped: InvalidParam[] = input.flatMap((item, index) =>
      findDroppedKeys(item, output[index], [...path, String(index)])
    );
    if (output.length < input.length) {
      dropped.push({
        name: path.join("."),
        reason: `${input.length - output.length} items were dropped`,
        code: "unsupported_field",
      });
    }
    return dropped;
  }

  if (isRecord(input) && isRecord(output)) {
    return Object.keys(input).flatMap((key) =>
      key in output
        ? findDroppedKeys(input[key], output[key], [...path, key])
        : [
            {
              name: [...path, key].join("."),
              reason: `Unsupported field '${key}'`,
              code: "unsupported_field" as const,
            },
          ]
    );
  }

  return [];
};

export type TWorkflowDocumentParseResult =
  | { ok: true; state: WorkflowEditableState }
  | { ok: false; invalidParams: InvalidParam[] };

/** Validate a pushed document and turn it into the state a push writes (`description` omitted → none). */
export const parseWorkflowDocument = (document: unknown): TWorkflowDocumentParseResult => {
  const parsed = ZV3WorkflowDocument.safeParse(document);
  if (!parsed.success) {
    return { ok: false, invalidParams: formatZodIssues(parsed.error, "document") };
  }

  const dropped = findDroppedKeys(document, parsed.data);
  if (dropped.length > 0) {
    return { ok: false, invalidParams: dropped };
  }

  const { name, description, definition } = parsed.data;
  return { ok: true, state: { name, description: description ?? null, definition } };
};

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])])
    );
  }
  return value;
};

/**
 * What `diffDocuments` compares: the document with the definition's members lifted to the top level, so a
 * change reads `definition.nodes[send-email] changed` instead of `definition changed`, and with every key
 * sorted, because a definition read back from the database has its keys in another order than the one an
 * agent sent.
 */
export const toDiffView = (document: Record<string, unknown>): Record<string, unknown> => {
  const { definition, ...rest } = document;
  const members = isRecord(definition)
    ? Object.fromEntries(Object.entries(definition).map(([key, value]) => [`definition.${key}`, value]))
    : { definition };
  return sortKeys({ ...rest, ...members }) as Record<string, unknown>;
};
