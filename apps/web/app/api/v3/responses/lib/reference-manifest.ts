import { z } from "zod";

/**
 * What a response write body says about things that are not its own.
 *
 * Twelve shipped security fixes on responses were the same shape: an id in the request body that
 * nobody checked against the caller's tenant (ENG-825, ENG-827, ENG-1923). Each was fixed where it
 * was found, and nothing stopped the next one — because nothing knew the *set* of references. This is
 * that set, declared once, with a test that fails when the schema grows a reference the manifest does
 * not know about.
 *
 * It is a manifest rather than a guard for a reason: a guard runs where someone remembered to call
 * it, and the failures above were all places nobody remembered. A declaration cannot be forgotten
 * quietly, because the test reads the schema rather than the code that enforces it.
 *
 * **Completeness comes from the roster below, not from the detectors.** An earlier version of this
 * file leaned on "id-shaped or named like an id ⇒ must be declared", and claimed that failed when the
 * schema grew a reference it did not know about. That was false for a third of the set it already
 * carried: `data`, `embeddedData` and `language` match neither rule, and deleting their declarations
 * left every test green. A record's keys are not reachable by the id-shape walk, and a plain string
 * is not reachable by the name rule — so the two detectors can only ever catch the references that
 * were already easy to spot. `V3_RESPONSE_BODY_FIELDS` classifies **every** field instead, and the
 * test holds it to the schema by set equality, so a new field fails until someone says what it is.
 * The detectors stay as a second, narrower check: they catch a field classified `none` that is
 * visibly an id.
 */

/** The four ways a request body can name something that has to belong to the caller. */
export type TV3ReferenceKind =
  /** A foreign key resolved against its own table, filtered by tenant. */
  | "fk"
  /** Resolved by attribute rather than by key — a Contact found by `(workspaceId, userId)`. */
  | "resolver"
  /** Set-membership against the already-scoped survey: an ending, a language, an element id. */
  | "document-local"
  /** An id *inside* a value, not a field of its own — the workspace id in a file-upload URL. */
  | "embedded-id"
  /** Not a reference. Recorded rather than omitted, so the roster can be checked for completeness. */
  | "none";

export type TV3Reference = {
  kind: TV3ReferenceKind;
  /** Where the value is resolved, in terms a reviewer can check against the code. */
  resolvedAgainst: string;
};

/**
 * A dedicated registry, deliberately not `.meta()`.
 *
 * `.meta()` is read by the OpenAPI generator, so declaring internal authorization facts there would
 * publish them to every client. This carries the same information without reaching the document.
 */
export const v3ResponseReferences = z.registry<TV3Reference>();

/** Attach a declaration to the exact schema instance a request body exposes on its shape. */
export const declareReference = <T extends z.ZodType>(schema: T, reference: TV3Reference): T => {
  v3ResponseReferences.add(schema, reference);
  return schema;
};

type TZodInternals = {
  _zod?: { def?: Record<string, unknown> };
  def?: Record<string, unknown>;
};

const defOf = (schema: unknown): Record<string, unknown> | undefined => {
  const candidate = schema as TZodInternals | null;
  return candidate?._zod?.def ?? candidate?.def;
};

/**
 * Walk a schema's wrappers looking for a declaration.
 *
 * `.optional()` and `.nullable()` each wrap the schema the declaration was attached to, so a direct
 * lookup on what the shape exposes misses it. Bounded rather than recursive-until-null so a cyclic
 * or unfamiliar schema cannot hang the suite.
 *
 * Fails safe: if Zod's internals move and the walk stops finding declarations, declared fields read
 * as undeclared and the test goes red. The opposite — silently reporting everything as declared —
 * is the failure mode this shape avoids.
 */
export const referenceFor = (schema: unknown): TV3Reference | undefined => {
  let current: unknown = schema;

  for (let depth = 0; current && depth < 10; depth += 1) {
    const found = v3ResponseReferences.get(current as z.ZodType);
    if (found) return found;

    const def = defOf(current);
    current = def?.innerType ?? def?.in ?? def?.schema;
  }

  return undefined;
};

/**
 * Whether a value is id-shaped, judged from the schema rather than the field name.
 *
 * This is the half that catches a reference nobody named like one: `z.cuid2()` carries
 * `format: "cuid2"`, and an array exposes its element, so a new `z.cuid2()` anywhere on a write body
 * is caught whatever it is called. The name rule beside it covers the ids that are plain strings —
 * `endingId` and `singleUseId` are not cuid2-validated, because neither is always a cuid.
 */
export const isIdShaped = (schema: unknown): boolean => {
  let current: unknown = schema;

  for (let depth = 0; current && depth < 10; depth += 1) {
    const def = defOf(current);
    if (def?.format === "cuid2" || def?.format === "cuid" || def?.format === "uuid") return true;

    current = def?.innerType ?? def?.in ?? def?.schema ?? def?.element;
  }

  return false;
};

/**
 * Every field on the two response write bodies, and what each one is.
 *
 * Exhaustive on purpose: the test asserts this set equals the schema's, so adding a field to either
 * body fails until it is classified here. That is the property the detectors cannot provide — they
 * see `z.cuid2()` and `*Id` names, and a survey-local map keyed by element ids is neither.
 */
export const V3_RESPONSE_BODY_FIELDS: Record<string, TV3ReferenceKind> = {
  // References.
  surveyId: "fk",
  contactId: "fk",
  displayId: "fk",
  tags: "fk",
  // The validate envelope's, naming the response a dry-run patch would target. Resolved exactly as a
  // real patch resolves it — `getResponseWorkspaceId` then the scoped read — so a dry run cannot be
  // used to probe whether a foreign response exists.
  responseId: "fk",
  endingId: "document-local",
  language: "document-local",
  data: "document-local",
  embeddedData: "document-local",
  singleUseId: "document-local",
  // Not references, and why.
  //
  // `ttc` is the one worth arguing about: its keys *are* element ids, which is what makes `data` a
  // reference. It is classified `none` because nothing resolves it — the values are client-reported
  // telemetry, clamped and stored verbatim, and a key naming no element costs a bucket nobody reads.
  // Element ids are survey-local and the survey is authorized before the write, so there is no tenant
  // question here; if `ttc` ever gains meaning beyond telemetry this is the line that has to change.
  finished: "none",
  meta: "none",
  ttc: "none",
  // The validate envelope's discriminator. Picks which planner runs, names nothing.
  operation: "none",
};

/** Field names that read as a reference even when the value is a plain string. */
export const looksLikeReferenceName = (name: string): boolean => /Ids?$/.test(name);

/**
 * Fields that must never appear on a response write body.
 *
 * The manifest can assert *declared ⇒ resolved*; it cannot assert *forbidden ⇒ absent*, because a
 * field nobody added is a field nobody declared. These are the ones whose presence would be the bug:
 * tenancy the caller must not choose, identity the server derives, and columns the runtime owns.
 */
export const V3_RESPONSE_DENIED_FIELDS = [
  // Tenancy is resolved from the survey and the credential, never taken from the body — accepting any
  // of these is the BOLA shape itself.
  "workspaceId",
  "environmentId",
  "organizationId",
  "projectId",
  // Identity the server derives. `userId` would be a `resolver` reference if it were ever accepted;
  // it is not, and that is the decision this records.
  "userId",
  "contactAttributes",
  // Owned by the runtime and the quota engine respectively.
  "createdAt",
  "updatedAt",
  "variables",
] as const;
