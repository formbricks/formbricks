/**
 * The AI UI kit: the shared marks and states every generative feature in the app uses, so AI reads
 * as one consistent thing rather than as whatever each feature invented.
 *
 * - `AiIcon` / `AiGlyph` — the single mark for AI, in three sizes.
 * - `AiStatusLine` — animated mark, status phrase, elapsed timer. The default waiting state.
 * - `AiActivityBar` — a hairline sweeping a surface that is being generated into.
 *
 * Feature-specific rendering (a survey draft, a chart preview) belongs with its feature; this
 * directory only holds what more than one surface can use.
 */
export { AiActivityBar } from "./components/ai-activity-bar";
export { AiGlyph, AiIcon, type AiIconProps } from "./components/ai-icon";
export { AiStatusLine, type AiStatusLineProps } from "./components/ai-status-line";
export { AI_STATUS_DEFAULT_CADENCE_MS, formatElapsed } from "./lib/status-line";
