import "server-only";
import { createHash } from "node:crypto";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import type {
  TCustomCssCompiled,
  TCustomCssError,
  TCustomCssScope,
  TCustomCssStored,
} from "@formbricks/types/custom-css";
import { cache } from "@/lib/cache";
import { CUSTOM_CSS_PROCESSOR_VERSION, processCustomCss } from "@/modules/custom-css/processor";
import { parseStoredCustomCss, toCustomCssSource } from "./service";

/**
 * How long reprocessed output for stale stored CSS is reused. Bounded so a stored source is recompiled
 * at most a few times a day rather than on every respondent request; the key carries the processor
 * version, so a processor or policy change is never answered from an older entry.
 */
export const CUSTOM_CSS_REPROCESS_TTL_MS = 6 * 60 * 60 * 1000;

type TReprocessed =
  | { ok: true; light: string | null; dark: string | null }
  | { ok: false; errors: TCustomCssError[] };

const compact = (light: string | null | undefined, dark: string | null | undefined) => {
  const compiled: TCustomCssCompiled = {
    ...(light ? { light } : {}),
    ...(dark ? { dark } : {}),
  };
  return compiled.light || compiled.dark ? compiled : undefined;
};

const hashSource = (scope: TCustomCssScope, stored: TCustomCssStored): string =>
  createHash("sha256")
    .update(JSON.stringify({ scope, source: toCustomCssSource(stored) }))
    .digest("hex");

/**
 * Stored output compiled by an older processor (or URL policy) is recompiled from its source under the
 * current one — never served as it is, because it may not pass today's policy. Cached by
 * (scope, current version, source hash) so the work happens once per revision rather than per request.
 */
const reprocessStale = async (stored: TCustomCssStored, scope: TCustomCssScope): Promise<TReprocessed> => {
  const input = toCustomCssSource(stored);
  if (!input) {
    return { ok: true, light: null, dark: null };
  }

  const run = async (): Promise<TReprocessed> => {
    try {
      const result = await processCustomCss({ scope, input });
      return result.ok
        ? { ok: true, light: result.compiled.light, dark: result.compiled.dark }
        : { ok: false, errors: result.errors };
    } catch (error) {
      logger.error({ error, scope }, "Reprocessing stored custom CSS threw");
      return {
        ok: false,
        errors: [
          {
            code: "processing_failed",
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

  return cache.withCache(
    run,
    createCacheKey.customCss.reprocessed(scope, CUSTOM_CSS_PROCESSOR_VERSION, hashSource(scope, stored)),
    CUSTOM_CSS_REPROCESS_TTL_MS
  );
};

/**
 * The respondent-facing CSS for one stored value (ENG-3552): compiled output only, never source. Absent
 * keys mean "no CSS" for that appearance, and `undefined` means no custom layer at all — no CSS, invalid
 * stored data, or stale output whose source no longer passes the current processor (withheld, never
 * served in its old form). The rollout flag is the caller's to apply, once per organization.
 */
export const toDeliveredCustomCss = async (
  stored: TCustomCssStored | null | undefined,
  scope: TCustomCssScope
): Promise<TCustomCssCompiled | undefined> => {
  const value = parseStoredCustomCss(stored);
  if (!value || (!value.light && !value.dark)) {
    return undefined;
  }

  if (value.processorVersion === CUSTOM_CSS_PROCESSOR_VERSION) {
    return compact(value.light?.compiled, value.dark?.compiled);
  }

  const reprocessed = await reprocessStale(value, scope);
  if (!reprocessed.ok) {
    logger.warn(
      { scope, storedVersion: value.processorVersion, currentVersion: CUSTOM_CSS_PROCESSOR_VERSION },
      "Withholding stored custom CSS that no longer passes the current processor"
    );
    return undefined;
  }

  return compact(reprocessed.light, reprocessed.dark);
};

export type TCustomCssHealth =
  | { status: "ok" }
  | { status: "stale" }
  | { status: "withheld"; errors: TCustomCssError[] };

/**
 * Creator-facing state of stored CSS. `stale`: compiled by an older processor, delivered by recompiling
 * its source. `withheld`: that source no longer passes the current processor, so respondents get no
 * custom CSS until a creator repairs and saves it. Shares delivery's cache, so it costs no extra work.
 */
export const getCustomCssHealth = async (
  stored: TCustomCssStored | null | undefined,
  scope: TCustomCssScope
): Promise<TCustomCssHealth> => {
  const value = parseStoredCustomCss(stored);
  if (!value || (!value.light && !value.dark) || value.processorVersion === CUSTOM_CSS_PROCESSOR_VERSION) {
    return { status: "ok" };
  }

  const reprocessed = await reprocessStale(value, scope);
  return reprocessed.ok ? { status: "stale" } : { status: "withheld", errors: reprocessed.errors };
};
