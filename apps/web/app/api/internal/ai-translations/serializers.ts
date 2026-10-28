import type { TAIUnavailableReason } from "@/lib/ai/service";

/**
 * Whether the survey editor may offer AI translation, and if not, why — the reason picks the message and
 * the upgrade or settings link the editor shows. `read_only` is never answered here: anyone who can read
 * the survey is told whether the organization has AI, and the translate call checks write access itself.
 */
export type TAITranslationAvailabilityResource =
  | { available: true }
  | { available: false; reason: Exclude<TAIUnavailableReason, "read_only"> };

/** The translated texts, keyed by the field paths the request named. */
export type TAITranslationResource = { translations: Record<string, string> };
