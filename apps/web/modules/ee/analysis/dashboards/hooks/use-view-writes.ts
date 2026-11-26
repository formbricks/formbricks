"use client";

import { useCallback, useRef } from "react";

/**
 * Writes made outside edit mode — duplicate, remove, undo — move the dashboard's version on the server.
 * They are counted so entering edit mode waits for them: pinning the edit's base from a copy read before
 * one of them landed would make the first save look stale, and offer to drop the change just made.
 */
export const useViewWrites = () => {
  const viewWritesRef = useRef(0);
  const viewWriteWaitersRef = useRef<(() => void)[]>([]);

  const beginViewWrite = useCallback(() => {
    viewWritesRef.current += 1;
  }, []);

  const endViewWrite = useCallback(() => {
    viewWritesRef.current = Math.max(0, viewWritesRef.current - 1);
    if (viewWritesRef.current === 0) {
      const waiters = viewWriteWaitersRef.current;
      viewWriteWaitersRef.current = [];
      for (const resolve of waiters) resolve();
    }
  }, []);

  const waitForViewWrites = useCallback(() => {
    if (viewWritesRef.current === 0) return Promise.resolve();
    const { promise, resolve } = Promise.withResolvers<void>();
    viewWriteWaitersRef.current.push(resolve);
    return promise;
  }, []);

  return { beginViewWrite, endViewWrite, waitForViewWrites };
};
