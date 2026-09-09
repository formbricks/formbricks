import { normalizeLanguageCode } from "@formbricks/i18n-utils/canonical";

/**
 * Qualtrics language codes → the region-qualified BCP-47 tags v3 stores (§6.3). Qualtrics uses its own
 * upper-case codes; most map through `normalizeLanguageCode`, a few need this table (`ZH-S`, `ZH-T`,
 * and the codes where Qualtrics' region default differs from ours).
 */
const QUALTRICS_OVERRIDES: Record<string, string> = {
  EN: "en-US",
  "EN-GB": "en-GB",
  DE: "de-DE",
  FR: "fr-FR",
  "FR-CA": "fr-CA",
  ES: "es-ES",
  "ES-ES": "es-ES",
  "ES-419": "es-419",
  PT: "pt-PT",
  "PT-BR": "pt-BR",
  "ZH-S": "zh-Hans-CN",
  "ZH-T": "zh-Hant-TW",
  NO: "nb-NO",
};

export type TQualtricsLanguageResult = { ok: true; code: string } | { ok: false; raw: string };

export function normalizeQualtricsLanguageCode(raw: string): TQualtricsLanguageResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, raw };

  const override = QUALTRICS_OVERRIDES[trimmed.toUpperCase()];
  if (override) return { ok: true, code: override };

  const normalized = normalizeLanguageCode(trimmed.replaceAll("_", "-"));
  return normalized ? { ok: true, code: normalized } : { ok: false, raw: trimmed };
}
