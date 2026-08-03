"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import {
  clearWorkflowNodeFieldFocusAtom,
  workflowNodeFieldFocusRequestAtom,
} from "@/modules/ee/workflows/state/editor";

interface UseWorkflowNodeFieldFocusArgs {
  /** Only requests aimed at this node are consumed. */
  nodeId: string;
  /** Maps the requested field to the element to focus; null/undefined skips focusing. */
  resolveElement: (field: string) => HTMLElement | null | undefined;
  /**
   * Runs before the focus, with the requested field. Config forms use it to reveal the field-level
   * errors the jump is meant to explain (the email step marks its blank fields touched).
   */
  onRequest?: (field: string) => void;
}

/**
 * Consumes a pending "take me to the field that's wrong" jump for one node: focuses the field the
 * validation problems dialog pointed at, scrolls it into view, then clears the request.
 *
 * Shared by every config form so the lifecycle exists once. Two details are easy to get wrong and
 * are the reason this is a hook rather than copied code:
 *
 * 1. The focus runs one frame late, so the inspector's width transition has laid the panel out
 *    before we scroll — otherwise `scrollIntoView` measures a collapsing column.
 * 2. The request is cleared INSIDE that frame, never before it. Clearing is what re-runs the
 *    effect, and clearing first would let the re-run's cleanup cancel the frame before it fired.
 *
 * `resolveElement`/`onRequest` are read through a ref, so callers may pass inline closures without
 * the effect re-running (and re-focusing) on every render.
 */
export const useWorkflowNodeFieldFocus = ({
  nodeId,
  resolveElement,
  onRequest,
}: UseWorkflowNodeFieldFocusArgs): void => {
  const focusRequest = useAtomValue(workflowNodeFieldFocusRequestAtom);
  const clearFocusRequest = useSetAtom(clearWorkflowNodeFieldFocusAtom);

  const callbacksRef = useRef({ resolveElement, onRequest });
  // Refreshed in an effect rather than during render (writing a ref while rendering is not allowed).
  // No dep array, so it runs after every render — and it is declared before the focus effect below,
  // so within a commit the callbacks are already current by the time that one reads them.
  useEffect(() => {
    callbacksRef.current = { resolveElement, onRequest };
  });

  useEffect(() => {
    if (focusRequest?.nodeId !== nodeId) return;
    const { field } = focusRequest;
    callbacksRef.current.onRequest?.(field);

    // requestAnimationFrame does not fire in a backgrounded tab, so a jump triggered just before
    // the tab was hidden lands when it is next shown. That is the desired behaviour here — the
    // point is to move the user's focus, which is meaningless while they are looking elsewhere.
    const frame = requestAnimationFrame(() => {
      const target = callbacksRef.current.resolveElement(field);
      target?.focus();
      target?.scrollIntoView({ block: "nearest" });
      clearFocusRequest();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest, nodeId, clearFocusRequest]);
};
