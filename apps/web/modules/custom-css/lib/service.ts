import "server-only";
import { z } from "zod";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import {
  CUSTOM_CSS_MAX_SOURCE_BYTES,
  type TCustomCssError,
  type TCustomCssInput,
  type TCustomCssScope,
  type TCustomCssStored,
  type TCustomCssWarning,
  ZCustomCssStored,
} from "@formbricks/types/custom-css";
import { InvalidInputError, OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { cache } from "@/lib/cache";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { normalizeCustomCssInput, processCustomCss } from "@/modules/custom-css/processor";
import { CUSTOM_CSS_PLAN_REQUIRED_MESSAGE, getCustomCssPlanAllowed } from "./access";
import { toCustomCssSource } from "./source";

export type TCustomCssWriteOutcome =
  | { ok: true; stored: TCustomCssStored | null; warnings: TCustomCssWarning[]; changed: boolean }
  | { ok: false; code: "invalid_css"; errors: TCustomCssError[] }
  | { ok: false; code: "plan_required" };

/**
 * A workspace save also returns, when it wrote, the revision it replaced as read under the row lock, so
 * an audit entry describes this save even when another writer changed the CSS just before it.
 */
export type TWorkspaceCustomCssWriteOutcome = TCustomCssWriteOutcome & { replaced?: TCustomCssStored | null };

/** What a write does to the stored CSS, judged on normalized source only — never on compiled output. */
export type TCustomCssChange = "unchanged" | "removal" | "edit";

/** An organization id, or a way to fetch it only when the plan actually has to be checked. */
type TOrganizationIdSource = string | (() => Promise<string>);

export { toCustomCssSource };

const normalizedFields = (input: TCustomCssInput | null | undefined) => {
  const normalized = normalizeCustomCssInput(input ?? null);
  return { light: normalized?.light ?? null, dark: normalized?.dark ?? null };
};

/**
 * Classify a write against what is stored. `removal` clears one or both fields without adding or editing
 * anything, which a downgraded Cloud organization may still do; anything that adds or edits source is
 * an `edit` and needs the plan.
 */
export const classifyCustomCssChange = (
  existing: TCustomCssStored | null | undefined,
  input: TCustomCssInput | null
): TCustomCssChange => {
  const before = normalizedFields(toCustomCssSource(existing));
  const after = normalizedFields(input);

  if (before.light === after.light && before.dark === after.dark) {
    return "unchanged";
  }

  const isFieldKeptOrCleared = (field: "light" | "dark") =>
    after[field] === before[field] || after[field] === null;

  return isFieldKeptOrCleared("light") && isFieldKeptOrCleared("dark") ? "removal" : "edit";
};

const removeFields = (
  existing: TCustomCssStored | null | undefined,
  input: TCustomCssInput | null
): TCustomCssStored | null => {
  const after = normalizedFields(input);
  const light = after.light === null ? null : (existing?.light ?? null);
  const dark = after.dark === null ? null : (existing?.dark ?? null);

  if (!existing || (!light && !dark)) {
    return null;
  }

  // Removal never reprocesses: the field that stays keeps its compiled output and the version it was
  // compiled under, so delivery still treats it as stale if the processor has moved on since.
  return { light, dark, processorVersion: existing.processorVersion };
};

const resolveOrganizationId = async (source: TOrganizationIdSource): Promise<string> =>
  typeof source === "string" ? source : await source();

/**
 * The source to process: the fields exactly as the creator typed them, so the processor's line and column
 * numbers match their editor, with empty fields (after normalization) dropped. `null` when nothing is left.
 */
const toProcessableSource = (input: TCustomCssInput | null | undefined): TCustomCssInput | null => {
  const fields = normalizedFields(input);
  if (fields.light === null && fields.dark === null) {
    return null;
  }
  return {
    light: fields.light === null ? null : (input?.light ?? null),
    dark: fields.dark === null ? null : (input?.dark ?? null),
  };
};

export type TCustomCssPreview =
  | { ok: true; compiled: { light: string | null; dark: string | null }; warnings: TCustomCssWarning[] }
  | { ok: false; errors: TCustomCssError[] };

/** The processor, with a throw turned into the same `processing_failed` error a rejection carries. */
const runProcessor = (scope: TCustomCssScope, source: TCustomCssInput) => {
  try {
    return processCustomCss({ scope, input: source });
  } catch (error) {
    logger.error({ error, scope }, "Custom CSS processor threw");
    return {
      ok: false as const,
      errors: [
        {
          code: "processing_failed" as const,
          scope,
          appearance: null,
          line: null,
          column: null,
          reason: "The custom CSS could not be processed.",
        },
      ],
    };
  }
};

/**
 * Dry run for previews and validation (ENG-3641): the same processor every save uses, with no plan check,
 * no write, no timestamp and no cache invalidation. Empty input is valid and compiles to nothing.
 * Synchronous, like the processor.
 */
export const previewCustomCss = (
  scope: TCustomCssScope,
  input: TCustomCssInput | null
): TCustomCssPreview => {
  const source = toProcessableSource(input);
  if (!source) {
    return { ok: true, compiled: { light: null, dark: null }, warnings: [] };
  }
  const result = runProcessor(scope, source);
  return result.ok
    ? { ok: true, compiled: result.compiled, warnings: result.warnings }
    : { ok: false, errors: result.errors };
};

/**
 * The one decision every custom CSS write path makes (ENG-2949). Pure apart from the plan lookup and
 * the processor; persisting the result is the caller's job.
 *
 * - Unchanged normalized source: the existing value back, with no plan check and no reprocessing.
 * - Removal of one field or all CSS: allowed on every plan, without reprocessing.
 * - Addition or edit: the Scale plan on Cloud, then one unit of `principal`'s custom CSS budget, then
 *   the shared processor. Nothing a caller supplied beyond the two source strings is ever trusted.
 */
export const resolveCustomCssWrite = async (args: {
  scope: TCustomCssScope;
  organizationId: TOrganizationIdSource;
  existing: TCustomCssStored | null | undefined;
  input: TCustomCssInput | null;
  /**
   * The user or API key id the processing is charged to, on the budget CSS validation spends. A spent
   * budget throws `TooManyRequestsError` before the processor runs. Left out only by a caller that
   * charges the budget itself, once per request: the workspace save.
   */
  principal?: string | null;
}): Promise<TCustomCssWriteOutcome> => {
  const { scope, existing, input } = args;
  const change = classifyCustomCssChange(existing, input);

  if (change === "unchanged") {
    return { ok: true, stored: existing ?? null, warnings: [], changed: false };
  }

  if (change === "removal") {
    return { ok: true, stored: removeFields(existing, input), warnings: [], changed: true };
  }

  const organizationId = await resolveOrganizationId(args.organizationId);
  if (!(await getCustomCssPlanAllowed(organizationId))) {
    return { ok: false, code: "plan_required" };
  }

  // The source the creator typed is what gets stored; normalization only decides which fields are empty.
  // An edit always leaves at least one field non-empty (clearing everything is a removal).
  const source = toProcessableSource(input) ?? { light: null, dark: null };

  if (args.principal) {
    await applyRateLimit(rateLimitConfigs.api.v3CustomCss, args.principal);
  }

  const result = runProcessor(scope, source);
  if (!result.ok) {
    return { ok: false, code: "invalid_css", errors: result.errors };
  }

  const stored: TCustomCssStored = {
    light: source.light === null ? null : { source: source.light, compiled: result.compiled.light ?? "" },
    dark: source.dark === null ? null : { source: source.dark, compiled: result.compiled.dark ?? "" },
    processorVersion: result.processorVersion,
  };

  return { ok: true, stored, warnings: result.warnings, changed: true };
};

/** Thrown by internal write paths whose callers expect exceptions rather than an outcome object. */
export class CustomCssPlanRequiredError extends OperationNotAllowedError {
  constructor() {
    super(CUSTOM_CSS_PLAN_REQUIRED_MESSAGE);
  }
}

/** Invalid CSS on an internal write path. `errors` carries the processor's located reasons. */
export class CustomCssInvalidError extends InvalidInputError {
  readonly errors: TCustomCssError[];

  constructor(errors: TCustomCssError[]) {
    super(formatCustomCssErrorsMessage(errors));
    this.errors = errors;
  }
}

/** `line 2:4`, `line 2`, or null when the error has no position. */
const formatErrorLine = (error: TCustomCssError): string | null => {
  if (error.line === null) {
    return null;
  }
  const line = `line ${String(error.line)}`;
  return error.column === null ? line : `${line}:${String(error.column)}`;
};

/** One bounded sentence for a toast or log line; the processor's reasons never echo customer source. */
export const formatCustomCssErrorsMessage = (errors: TCustomCssError[]): string => {
  const first = errors[0];
  if (!first) {
    return "Custom CSS could not be processed.";
  }
  const where = [first.appearance ? `${first.appearance} CSS` : null, formatErrorLine(first)]
    .filter(Boolean)
    .join(", ");
  const location = where ? ` (${where})` : "";
  const more = errors.length > 1 ? ` (+${String(errors.length - 1)} more)` : "";
  return `Custom CSS could not be saved${location}: ${first.reason}${more}`;
};

/** {@link resolveCustomCssWrite} for exception-style callers: the outcome on success, typed errors otherwise. */
export const resolveCustomCssWriteOrThrow = async (
  args: Parameters<typeof resolveCustomCssWrite>[0]
): Promise<Extract<TCustomCssWriteOutcome, { ok: true }>> => {
  const outcome = await resolveCustomCssWrite(args);
  if (outcome.ok) {
    return outcome;
  }
  if (outcome.code === "plan_required") {
    throw new CustomCssPlanRequiredError();
  }
  throw new CustomCssInvalidError(outcome.errors);
};

const ZPayloadSource = z.string().max(CUSTOM_CSS_MAX_SOURCE_BYTES.workspace);
const ZPayloadEntry = z.object({ source: ZPayloadSource }).loose().nullable();

/**
 * Full-object payloads (the editor's survey save, a TSurvey round trip) carry custom CSS in its stored
 * shape. Only `source` is read; `compiled` and `processorVersion` are ignored, because a caller's compiled
 * CSS is never trusted. Lenient on purpose about everything else, since the draft save does not validate
 * the survey schema, but bounded so an oversized field is refused before any processing.
 *
 * Returns `undefined` when the payload carries no CSS key at all, meaning "leave it unchanged".
 */
export const readCustomCssPayloadSource = (payload: unknown): TCustomCssInput | null | undefined => {
  if (payload === undefined) {
    return undefined;
  }
  const parsed = z
    .object({ light: ZPayloadEntry, dark: ZPayloadEntry })
    .loose()
    .nullable()
    .safeParse(payload);
  if (!parsed.success) {
    throw new InvalidInputError("Custom CSS must be { light, dark } with a source string or null for each.");
  }
  if (parsed.data === null) {
    return null;
  }
  return { light: parsed.data.light?.source ?? null, dark: parsed.data.dark?.source ?? null };
};

const parseStored = (value: unknown, label: string): TCustomCssStored | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = ZCustomCssStored.safeParse(value);
  if (!parsed.success) {
    logger.error({ label }, "Stored custom CSS does not match its schema; treating it as absent");
    return null;
  }
  return parsed.data;
};

export const parseStoredCustomCss = (value: unknown): TCustomCssStored | null =>
  parseStored(value, "custom css");

export type TWorkspaceCustomCssRecord = {
  customCss: TCustomCssStored | null;
  previous: TCustomCssStored | null;
};

/** Current and previous workspace CSS. Throws `ResourceNotFoundError` for an unknown workspace. */
export const getWorkspaceCustomCssRecord = async (
  workspaceId: string
): Promise<TWorkspaceCustomCssRecord> => {
  const row = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customCss: true, customCssPrevious: true },
  });
  if (!row) {
    throw new ResourceNotFoundError("Workspace", workspaceId);
  }
  return {
    customCss: parseStored(row.customCss, "workspace.customCss"),
    previous: parseStored(row.customCssPrevious, "workspace.customCssPrevious"),
  };
};

const toJsonColumn = (value: TCustomCssStored | null) => value ?? Prisma.DbNull;

/**
 * Drop the server configuration caches a CSS change reaches. Workspace CSS is delivered once per
 * environment-state response, never copied into surveys, so the workspace state is all there is.
 * Best-effort: a failed invalidation only delays the change by the cache TTL.
 */
export const invalidateCustomCssCaches = async (workspaceId: string): Promise<void> => {
  try {
    const result = await cache.del([createCacheKey.workspace.state(workspaceId)]);
    if (!result.ok) {
      logger.warn({ workspaceId }, "Could not invalidate the workspace state after a custom CSS change");
    }
  } catch (error) {
    logger.warn({ error, workspaceId }, "Could not invalidate the workspace state after a custom CSS change");
  }
};

type TWorkspaceCustomCssLockRow = { customCss: unknown };

/** Optimistic saves that process outside the row lock before one falls back to deciding under it. */
const WORKSPACE_CUSTOM_CSS_OPTIMISTIC_ATTEMPTS = 2;

/**
 * Whether two stored values are the same revision for a save's purposes: the same normalized source
 * compiled under the same processor version. Compiled output is never compared.
 */
export const isSameStoredCustomCss = (
  a: TCustomCssStored | null | undefined,
  b: TCustomCssStored | null | undefined
): boolean =>
  classifyCustomCssChange(a, toCustomCssSource(b)) === "unchanged" &&
  (a?.processorVersion ?? null) === (b?.processorVersion ?? null);

const readWorkspaceCustomCss = async (
  workspaceId: string,
  organizationId: string
): Promise<TCustomCssStored | null> => {
  const row = await prisma.workspace.findUnique({
    where: { id: workspaceId, organizationId },
    select: { customCss: true },
  });
  if (!row) {
    throw new ResourceNotFoundError("Workspace", workspaceId);
  }
  return parseStored(row.customCss, "workspace.customCss");
};

/**
 * Locks the workspace row, re-reads its CSS and lets `decide` settle the save against it: the outcome to
 * persist, or `null` when the row is no longer what the outcome was resolved against. On a real change
 * the value being replaced becomes `customCssPrevious` — the one recoverable revision — unless there was
 * nothing to replace, in which case the older revision stays recoverable.
 */
const commitWorkspaceCustomCss = async <TOutcome extends TCustomCssWriteOutcome | null>(
  workspaceId: string,
  organizationId: string,
  decide: (current: TCustomCssStored | null) => TOutcome | Promise<TOutcome>
): Promise<{ outcome: TOutcome; current: TCustomCssStored | null }> =>
  prisma.$transaction(
    async (tx) => {
      const [row] = await tx.$queryRaw<TWorkspaceCustomCssLockRow[]>`
        SELECT "customCss"
        FROM "Workspace"
        WHERE "id" = ${workspaceId} AND "organizationId" = ${organizationId}
        FOR UPDATE
      `;
      if (!row) {
        throw new ResourceNotFoundError("Workspace", workspaceId);
      }

      const current = parseStored(row.customCss, "workspace.customCss");
      const outcome = await decide(current);
      if (outcome?.ok && outcome.changed) {
        await tx.workspace.update({
          where: { id: workspaceId, organizationId },
          data: {
            customCss: toJsonColumn(outcome.stored),
            ...(current ? { customCssPrevious: current } : {}),
          },
          select: { id: true },
        });
      }
      return { outcome, current };
    },
    { timeout: 20_000, maxWait: 10_000 }
  );

/**
 * Save workspace CSS (ENG-2949). Authorization is the caller's: see `canWriteWorkspaceCustomCss`.
 *
 * The processor is synchronous and CPU-bound, so it runs before the row is locked: the save reads the
 * stored value, resolves the write against it, then locks the row in a short transaction and persists
 * only if the stored revision is still the one it resolved against ({@link isSameStoredCustomCss}). A
 * concurrent change can make that decision stale — edit or removal, so whether the plan applies, and
 * what becomes `customCssPrevious` — so the save re-resolves against the newer value, once. A third
 * contender is settled under the lock, so every save still ends in one serialized decision. Failures
 * and unchanged source write nothing, so the previous revision stays live.
 */
export const updateWorkspaceCustomCss = async (args: {
  workspaceId: string;
  organizationId: string;
  input: TCustomCssInput | null;
}): Promise<TWorkspaceCustomCssWriteOutcome> => {
  const { workspaceId, organizationId, input } = args;
  // No principal: the route charges the custom CSS budget once per request, however often this re-resolves.
  const resolve = (existing: TCustomCssStored | null) =>
    resolveCustomCssWrite({ scope: "workspace", organizationId, existing, input });
  const finish = async (
    outcome: TCustomCssWriteOutcome,
    replaced: TCustomCssStored | null
  ): Promise<TWorkspaceCustomCssWriteOutcome> => {
    if (!outcome.ok || !outcome.changed) {
      return outcome;
    }
    await invalidateCustomCssCaches(workspaceId);
    return { ...outcome, replaced };
  };

  // Resolves against `existing` and persists only if the row still holds it; on a conflict, tries again
  // against the newer value while optimistic attempts remain, then decides under the lock.
  const save = async (
    existing: TCustomCssStored | null,
    attemptsLeft: number
  ): Promise<TWorkspaceCustomCssWriteOutcome> => {
    if (attemptsLeft === 0) {
      const { outcome, current } = await commitWorkspaceCustomCss(workspaceId, organizationId, resolve);
      return await finish(outcome, current);
    }

    const resolved = await resolve(existing);
    if (!resolved.ok || !resolved.changed) {
      return resolved;
    }

    const commit = await commitWorkspaceCustomCss(workspaceId, organizationId, (current) =>
      isSameStoredCustomCss(current, existing) ? resolved : null
    );
    if (commit.outcome) {
      return await finish(commit.outcome, commit.current);
    }
    return await save(commit.current, attemptsLeft - 1);
  };

  return await save(
    await readWorkspaceCustomCss(workspaceId, organizationId),
    WORKSPACE_CUSTOM_CSS_OPTIMISTIC_ATTEMPTS
  );
};

export type TCopiedSurveyCustomCss = {
  customCss: TCustomCssStored | null;
  /** Set when the source survey had CSS that the copy could not carry. */
  notice?: "plan_required" | "invalid_css";
};

/**
 * Survey CSS for a copy or duplicate (ENG-2949): the source survey's CSS *source*, processed afresh for
 * the destination under the destination organization's plan. A destination that may not add CSS gets
 * the copy without it, plus a notice; the source survey is never touched. Processing is charged to
 * `principal` like any other edit, and a spent budget refuses the copy rather than dropping its CSS.
 */
export const resolveCopiedSurveyCustomCss = async (args: {
  source: unknown;
  destinationOrganizationId: string;
  principal?: string | null;
}): Promise<TCopiedSurveyCustomCss> => {
  const input = toCustomCssSource(parseStored(args.source, "survey.customCss (copy source)"));
  if (!input) {
    return { customCss: null };
  }

  const outcome = await resolveCustomCssWrite({
    scope: "survey",
    organizationId: args.destinationOrganizationId,
    existing: null,
    input,
    principal: args.principal,
  });

  if (outcome.ok) {
    return { customCss: outcome.stored };
  }

  return { customCss: null, notice: outcome.code };
};
