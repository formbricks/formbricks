/** How long a message holds before the uncontrolled cycle advances to the next one. */
export const AI_STATUS_DEFAULT_CADENCE_MS = 2500;

const SECONDS_PER_MINUTE = 60;

/**
 * Elapsed wall-clock, in the shortest honest form: `6s`, `59s`, `1m 4s`.
 *
 * Elapsed time rather than a percentage on purpose — the model gives no progress signal, so any bar
 * would be invented. A counter that is simply true is what makes a long wait tolerable.
 */
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

  if (totalSeconds < SECONDS_PER_MINUTE) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

  return `${minutes}m ${seconds}s`;
}

/**
 * Which message an uncontrolled status line should be showing.
 *
 * Advances on the cadence and then **holds on the last message** — it never wraps. Cycling back to
 * "Reading your prompt…" thirty seconds in would tell the user the work had restarted.
 */
export function getCycledIndex({
  elapsedMs,
  cadenceMs,
  messageCount,
}: {
  elapsedMs: number;
  cadenceMs: number;
  messageCount: number;
}): number {
  if (messageCount <= 0) return 0;
  if (cadenceMs <= 0) return messageCount - 1;

  const step = Math.floor(Math.max(0, elapsedMs) / cadenceMs);

  return Math.min(step, messageCount - 1);
}

/**
 * The message to render, given both modes. A caller that knows its real progress passes
 * `activeIndex` and wins over the clock; one that does not omits it and gets the timed cycle.
 */
export function resolveStatusMessage({
  messages,
  activeIndex,
  elapsedMs,
  cadenceMs,
}: {
  messages: readonly string[];
  activeIndex?: number;
  elapsedMs: number;
  cadenceMs: number;
}): string {
  if (messages.length === 0) return "";

  const index =
    activeIndex === undefined
      ? getCycledIndex({ elapsedMs, cadenceMs, messageCount: messages.length })
      : Math.min(Math.max(activeIndex, 0), messages.length - 1);

  return messages[index];
}
