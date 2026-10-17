import "server-only";
import { createHash } from "node:crypto";
import { createCacheKey } from "@formbricks/cache";
import { CREATIVE_ROOT_CLASS, type TCreativeCustomCss } from "@formbricks/creatives";
import { logger } from "@formbricks/logger";
import type { TCustomCssInput } from "@formbricks/types/custom-css";
import { cache } from "@/lib/cache";
import {
  CUSTOM_CSS_PROCESSOR_VERSION,
  type TCustomCssRoot,
  normalizeCustomCssInput,
  processCustomCss,
} from "@/modules/custom-css/processor";
import type { TCreativeType } from "./creative";
import { CREATIVE_CSS_SCOPE } from "./style";

/**
 * A creative's own Custom CSS (ENG-3865, ADR 0012). It is stored as source in the creative's styling (the
 * stored JSON is the API JSON) and compiled by the survey CSS processor, scoped to the creative's root
 * element inside its shadow root instead of `#fbjs`. It runs under the processor's `survey` scope: the
 * same 20 KB budget and the same `fb-survey` layers, which inside a shadow root order nothing but the
 * creative's own rules. The workspace Custom CSS is never compiled for, or sent to, a creative.
 *
 * This module is on the environment request's path, so it talks to the processor directly; the write
 * checks (plan, budget) live in `custom-css-write.ts`. The scope constant is in `style.ts`, so the
 * editor (client) budgets the same way.
 */
export { CREATIVE_CSS_SCOPE };

export const getCreativeCssRoot = (type: TCreativeType): TCustomCssRoot => ({
  type: "class",
  name: CREATIVE_ROOT_CLASS[type],
});

/** Same bound as reprocessed survey CSS: a source is compiled a few times a day, not per request. */
const COMPILED_TTL_MS = 6 * 60 * 60 * 1000;

const hashSource = (type: TCreativeType, source: TCustomCssInput): string =>
  createHash("sha256")
    .update(JSON.stringify({ root: CREATIVE_ROOT_CLASS[type], source }))
    .digest("hex");

type TCompiled = { ok: true; css: TCreativeCustomCss | null } | { ok: false };

const compile = (type: TCreativeType, source: TCustomCssInput): TCompiled => {
  const normalized = normalizeCustomCssInput(source);
  if (!normalized?.light && !normalized?.dark) return { ok: true, css: null };

  // The source as typed (empty fields dropped), so line numbers match the author's editor.
  const input = { light: normalized.light ? source.light : null, dark: normalized.dark ? source.dark : null };
  const result = processCustomCss({ scope: CREATIVE_CSS_SCOPE, input }, { root: getCreativeCssRoot(type) });
  if (!result.ok) return { ok: false };
  const { light, dark } = result.compiled;
  const css: TCreativeCustomCss = { ...(light ? { light } : {}), ...(dark ? { dark } : {}) };
  return { ok: true, css: css.light || css.dark ? css : null };
};

/**
 * The compiled CSS a visitor's browser gets for one creative, or `null` for none. Compiled at most once
 * per source, root and processor version (cached like reprocessed survey CSS), so the environment
 * request doesn't run the processor. CSS the current processor rejects is withheld, never sent as it was.
 */
export const compileCreativeCustomCss = async (
  type: TCreativeType,
  source: TCustomCssInput
): Promise<TCreativeCustomCss | null> => {
  try {
    const compiled = await cache.withCache(
      () => Promise.resolve(compile(type, source)),
      createCacheKey.customCss.reprocessed(
        CREATIVE_CSS_SCOPE,
        CUSTOM_CSS_PROCESSOR_VERSION,
        hashSource(type, source)
      ),
      COMPILED_TTL_MS
    );
    if (compiled.ok) return compiled.css;
    logger.warn({ type }, "Withholding creative custom CSS that no longer passes the current processor");
    return null;
  } catch (error) {
    logger.warn({ error, type }, "Creative custom CSS could not be prepared for delivery; withholding it");
    return null;
  }
};
