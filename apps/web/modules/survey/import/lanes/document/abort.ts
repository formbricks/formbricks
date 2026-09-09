/**
 * The AI package forwards `abortSignal` to the provider but has no `timeout` of its own, so a stalled
 * model call would hold the stream open until the client gives up. Every model call in the lane gets a
 * signal that fires on the caller's abort *or* after `timeoutMs`, whichever comes first.
 */
export function abortAfter(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
