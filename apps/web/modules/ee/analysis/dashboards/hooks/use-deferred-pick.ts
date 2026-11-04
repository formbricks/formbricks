"use client";

import { useCallback, useState } from "react";

/**
 * A list filter's ticked values while its list is open. Ticking only changes the draft; `apply`
 * hands the result over once, when the list closes, and only when it differs. Every applied pick
 * reloads every chart and adds a history entry, so a person ticking five values causes one of each,
 * not five.
 */
export const useDeferredPick = (selected: readonly string[], onApply: (values: string[]) => void) => {
  const [draft, setDraft] = useState<string[]>([...selected]);
  const [source, setSource] = useState(selected);
  // A pick changed from outside (the chip's ×, back/forward) resets the draft.
  if (source !== selected && source.join("\u0000") !== selected.join("\u0000")) {
    setSource(selected);
    setDraft([...selected]);
  }

  const toggle = useCallback(
    (value: string) =>
      setDraft((current) =>
        current.includes(value) ? current.filter((candidate) => candidate !== value) : [...current, value]
      ),
    []
  );

  const apply = useCallback(() => {
    const unchanged = draft.length === selected.length && draft.every((value) => selected.includes(value));
    if (!unchanged) onApply(draft);
  }, [draft, onApply, selected]);

  return { draft, toggle, apply };
};
