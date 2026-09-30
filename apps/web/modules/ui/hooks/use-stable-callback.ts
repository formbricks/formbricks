import { useCallback, useInsertionEffect, useRef } from "react";

/**
 * Returns a function whose identity never changes but which always runs the `callback` from the
 * latest committed render. Use it for handlers passed to memoized children: the child can skip
 * re-rendering without holding on to a stale closure.
 *
 * The ref is refreshed in an insertion effect, which runs before every layout and passive effect of
 * the same commit, so children that call the handler from their own effects see the fresh closure.
 * Do not call the returned function during render.
 */
export const useStableCallback = <TArgs extends unknown[], TReturn>(
  callback: (...args: TArgs) => TReturn
): ((...args: TArgs) => TReturn) => {
  const callbackRef = useRef(callback);

  useInsertionEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback((...args: TArgs) => callbackRef.current(...args), []);
};
