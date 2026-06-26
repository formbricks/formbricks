import { normalizeLanguageCode } from "@formbricks/i18n-utils/src/canonical";
import type { LanguageMergePlan, LanguageRow, SurveyLanguageMoves, SurveyLanguageRow } from "./types";

/**
 * Canonicalize a stored language code. Unparseable / unknown codes are returned unchanged (never
 * dropped) so junk values survive the migration untouched; callers compare input vs output to decide
 * whether a write is needed and to collect the unresolved codes for logging.
 */
export const toCanonical = (code: string): string => normalizeLanguageCode(code) ?? code;

/**
 * An i18nString is `{ default: string, <langCode>: string, ... }` (Zod: `record(string, string)` with a
 * required `default`). We treat an object as one iff it has a string `default` key AND every own value is
 * a string — that uniquely identifies survey i18n content and avoids false positives on config objects
 * (e.g. `{ enabled: true }`) that merely happen to nest a `default`.
 */
const isI18nString = (value: unknown): value is Record<string, string> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.default !== "string") return false;
  return Object.values(record).every((v) => typeof v === "string");
};

// When two source keys canonicalize to the same target, pick the value to keep: a non-empty value beats
// an empty one; if both are non-empty (or both empty) the value that came from the already-canonical key
// wins; otherwise the first one seen is kept (stable).
const pickI18nValue = (
  existing: { value: string; fromCanonicalKey: boolean },
  incoming: { value: string; fromCanonicalKey: boolean }
): { value: string; fromCanonicalKey: boolean } => {
  const existingEmpty = existing.value.trim().length === 0;
  const incomingEmpty = incoming.value.trim().length === 0;
  if (existingEmpty && !incomingEmpty) return incoming;
  if (!existingEmpty && incomingEmpty) return existing;
  if (incoming.fromCanonicalKey && !existing.fromCanonicalKey) return incoming;
  return existing;
};

interface RewriteResult {
  value: unknown;
  changed: boolean;
  keysRewritten: number;
  unresolved: string[];
}

/**
 * Recursively walk a survey content value and rewrite every i18nString's language keys to their
 * canonical BCP-47 form, merging keys that collapse to the same canonical (e.g. `de` + `de-DE` →
 * `de-DE`). The `default` sentinel key is preserved verbatim. Returns a new value (input is not
 * mutated) plus whether anything changed.
 */
export const rewriteI18nKeys = (value: unknown): RewriteResult => {
  if (Array.isArray(value)) {
    const results = value.map((item) => rewriteI18nKeys(item));
    const changed = results.some((result) => result.changed);
    const keysRewritten = results.reduce((sum, result) => sum + result.keysRewritten, 0);
    const unresolved = results.flatMap((result) => result.unresolved);
    return {
      value: changed ? results.map((result) => result.value) : value,
      changed,
      keysRewritten,
      unresolved,
    };
  }

  if (isI18nString(value)) {
    let changed = false;
    let keysRewritten = 0;
    const unresolved: string[] = [];
    // target code -> chosen value (default handled separately so it always stays first / untouched)
    const merged = new Map<string, { value: string; fromCanonicalKey: boolean }>();

    for (const [key, raw] of Object.entries(value)) {
      if (key === "default") continue;
      if (normalizeLanguageCode(key) === null) unresolved.push(key);
      const target = toCanonical(key);
      if (target !== key) {
        changed = true;
        keysRewritten += 1;
      }
      const incoming = { value: raw, fromCanonicalKey: key === target };
      const existing = merged.get(target);
      if (existing) {
        changed = true; // two source keys collapsed into one
        merged.set(target, pickI18nValue(existing, incoming));
      } else {
        merged.set(target, incoming);
      }
    }

    if (!changed) return { value, changed: false, keysRewritten: 0, unresolved };

    const next: Record<string, string> = { default: value.default };
    for (const [code, picked] of merged) {
      next[code] = picked.value;
    }
    return { value: next, changed: true, keysRewritten, unresolved };
  }

  if (typeof value === "object" && value !== null) {
    let changed = false;
    let keysRewritten = 0;
    const unresolved: string[] = [];
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const result = rewriteI18nKeys(child);
      if (result.changed) changed = true;
      keysRewritten += result.keysRewritten;
      unresolved.push(...result.unresolved);
      next[key] = result.value;
    }
    return { value: changed ? next : value, changed, keysRewritten, unresolved };
  }

  return { value, changed: false, keysRewritten: 0, unresolved: [] };
};

// Deterministic survivor ordering when no row already holds the canonical code: oldest first, then by
// id, so the migration is reproducible regardless of row fetch order.
const byCreatedAtThenId = (a: LanguageRow, b: LanguageRow): number => {
  const delta = a.createdAt.getTime() - b.createdAt.getTime();
  return delta !== 0 ? delta : a.id.localeCompare(b.id);
};

/**
 * Plan how every `Language` row should change. Rows are grouped per workspace by their canonical code:
 * a singleton group is a plain relabel; a group of 2+ is a collision (e.g. bare `de` + region `de-DE`)
 * where one row survives (preferring a row already at the canonical code, else the oldest) and the rest
 * are absorbed. The `@@unique([workspaceId, code])` constraint is why collisions can't just be relabelled.
 */
export const planLanguageMerges = (languages: LanguageRow[]): LanguageMergePlan => {
  const groups = new Map<string, LanguageRow[]>();
  for (const row of languages) {
    const canonical = toCanonical(row.code);
    const groupKey = `${row.workspaceId}::${canonical}`;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(groupKey, [row]);
    }
  }

  const plan: LanguageMergePlan = { relabels: [], merges: [] };

  for (const group of groups.values()) {
    const canonical = toCanonical(group[0].code);

    if (group.length === 1) {
      const [row] = group;
      if (row.code !== canonical) {
        plan.relabels.push({ id: row.id, toCode: canonical });
      }
      continue;
    }

    const survivor = group.find((row) => row.code === canonical) ?? [...group].sort(byCreatedAtThenId)[0];
    const absorbed = group.filter((row) => row.id !== survivor.id);
    const aliasToSet = survivor.alias ? null : (absorbed.find((row) => row.alias)?.alias ?? null);

    plan.merges.push({
      workspaceId: survivor.workspaceId,
      canonical,
      survivorId: survivor.id,
      survivorNeedsRelabel: survivor.code !== canonical,
      aliasToSet,
      absorbedIds: absorbed.map((row) => row.id),
    });
  }

  return plan;
};

/**
 * Plan how `SurveyLanguage` links move when absorbed languages merge into a survivor. A link moves
 * straight over (repoint) unless the survivor already links that survey, in which case the absorbed link
 * is dropped (the composite PK `@@id([languageId, surveyId])` forbids duplicates) and any `default` /
 * `enabled` flags it carried are bumped onto the survivor's surviving link.
 */
export const planSurveyLanguageMoves = (
  survivorId: string,
  absorbedIds: string[],
  links: SurveyLanguageRow[]
): SurveyLanguageMoves => {
  const absorbed = new Set(absorbedIds);
  const survivorLinksBySurvey = new Map<string, SurveyLanguageRow>();
  const occupiedSurveyIds = new Set<string>();

  for (const link of links) {
    if (link.languageId === survivorId) {
      survivorLinksBySurvey.set(link.surveyId, link);
      occupiedSurveyIds.add(link.surveyId);
    }
  }

  // Stable order so multiple absorbed links to the same survey resolve deterministically.
  const absorbedLinks = links
    .filter((link) => absorbed.has(link.languageId))
    .sort((a, b) => a.surveyId.localeCompare(b.surveyId) || a.languageId.localeCompare(b.languageId));

  const moves: SurveyLanguageMoves = { repoints: [], deletes: [], flagUpdates: [] };
  const flagUpdatesBySurvey = new Map<string, { surveyId: string; default: boolean; enabled: boolean }>();

  for (const link of absorbedLinks) {
    if (occupiedSurveyIds.has(link.surveyId)) {
      moves.deletes.push({ surveyId: link.surveyId, languageId: link.languageId });

      const survivorLink = survivorLinksBySurvey.get(link.surveyId);
      const current = flagUpdatesBySurvey.get(link.surveyId) ?? {
        surveyId: link.surveyId,
        default: survivorLink?.default ?? false,
        enabled: survivorLink?.enabled ?? true,
      };
      const next = {
        surveyId: link.surveyId,
        default: current.default || link.default,
        enabled: current.enabled || link.enabled,
      };
      flagUpdatesBySurvey.set(link.surveyId, next);
    } else {
      moves.repoints.push({ surveyId: link.surveyId, fromLanguageId: link.languageId });
      occupiedSurveyIds.add(link.surveyId);
    }
  }

  // Only emit a flag update when it actually differs from the survivor's current link.
  for (const update of flagUpdatesBySurvey.values()) {
    const survivorLink = survivorLinksBySurvey.get(update.surveyId);
    if (survivorLink?.default !== update.default || survivorLink.enabled !== update.enabled) {
      moves.flagUpdates.push(update);
    }
  }

  return moves;
};
