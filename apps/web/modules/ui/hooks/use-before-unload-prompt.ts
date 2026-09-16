"use client";

import { useEffect, useRef } from "react";

export type UseBeforeUnloadPromptOptions = {
  /** Skip registration entirely — a read-only user, or a builder that has not loaded yet. */
  enabled?: boolean;
};

/**
 * Show the browser's "leave site?" confirmation on tab close, reload or hard navigation while there
 * is work that would be lost.
 *
 * Named for what it does. It is **not** a navigation guard: the App Router exposes no supported way
 * to block `router.push`, a `<Link>`, or the back button, and the workarounds (patching
 * `history.pushState`, capturing every anchor click) are global and fragile. A caller that needs to
 * protect in-app navigation has to solve that separately.
 *
 * `shouldPrompt` is read at event time through a ref rather than captured at registration, so the
 * listener attaches once and callers need neither `useCallback` nor a dependency list mirroring
 * their dirty-state. That is the whole reason this hook exists — the hand-rolled `beforeunload`
 * blocks it replaces each work around that problem differently.
 *
 * There is no `message` parameter: browsers have ignored custom text for years and show their own.
 */
export function useBeforeUnloadPrompt(
  shouldPrompt: () => boolean,
  { enabled = true }: UseBeforeUnloadPromptOptions = {}
): void {
  const shouldPromptRef = useRef(shouldPrompt);

  useEffect(() => {
    shouldPromptRef.current = shouldPrompt;
  });

  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldPromptRef.current()) return;

      event.preventDefault();
      // `returnValue` is deprecated, and kept deliberately: `preventDefault()` alone is enough on
      // current Chrome, Firefox and Safari, but older Chromium shows no dialog without it. There is
      // no browserslist target in this repo that rules those out, and the cost of being wrong is a
      // user silently losing a generation.
      event.returnValue = ""; // NOSONAR
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled]);
}
