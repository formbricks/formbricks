const SKEW_TOLERANCE_MS = 2 * 60_000;

/**
 * How old a payload can be when it arrives: the CDN keeps it 60 s and serves it stale for 60 s more
 * while revalidating, and the browser caches it another 60 s. `serverTime` is when the origin built it.
 */
const MAX_PAYLOAD_AGE_MS = 3 * 60_000;

/**
 * What to add to the device clock to read the server's, from the payload's `serverTime` and the device
 * time it arrived at (epoch ms). Schedules are exact to the minute, so a skew of up to ~2 min is left
 * alone.
 *
 * A cached payload only ever makes `serverTime` look earlier than it was, so a device behind the server
 * is certain once it is more than the tolerance behind, but a device that looks ahead can be a correct
 * clock reading an old payload: it is only corrected once it is ahead by more than any payload can be old.
 */
export const getClockOffset = (serverTime: string | undefined, receivedAt: number): number => {
  const server = serverTime ? Date.parse(serverTime) : Number.NaN;
  if (Number.isNaN(server)) return 0;

  const offset = server - receivedAt;
  if (offset > SKEW_TOLERANCE_MS || offset < -(SKEW_TOLERANCE_MS + MAX_PAYLOAD_AGE_MS)) return offset;
  return 0;
};
