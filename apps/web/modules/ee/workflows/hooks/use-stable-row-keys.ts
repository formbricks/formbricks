"use client";

import { useState } from "react";

let lastKey = 0;
const newKey = (): string => {
  lastKey += 1;
  return `row-${lastKey.toString()}`;
};

/**
 * React keys for the rows of a list edited in place (query parameters, headers, Embedded Data). A row's
 * key follows the row, not its position, so removing one keeps focus and typed text in the rows after it.
 * Call `remove(index)` in the same handler that removes the row. Rows added at the end get new keys;
 * a list shortened from outside (undo, a reload) loses keys from the end.
 */
export const useStableRowKeys = (count: number): { keys: string[]; remove: (index: number) => void } => {
  const [keys, setKeys] = useState<string[]>(() => Array.from({ length: count }, newKey));

  let current = keys;
  if (keys.length !== count) {
    // Adjusting state while rendering, as React documents for state derived from props.
    current =
      keys.length < count
        ? [...keys, ...Array.from({ length: count - keys.length }, newKey)]
        : keys.slice(0, count);
    setKeys(current);
  }

  const remove = (index: number) => setKeys((previous) => previous.filter((_, i) => i !== index));
  return { keys: current, remove };
};
