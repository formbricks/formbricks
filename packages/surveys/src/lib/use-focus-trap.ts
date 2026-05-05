import { type MutableRef, useEffect, useRef } from "preact/hooks";

type FocusScope = { paused: boolean; pause: () => void; resume: () => void };
type FocusableTarget = HTMLElement | { focus: (options?: FocusOptions) => void };
type UseFocusTrapOptions = {
  enabled: boolean;
  onEscapeKeyDown?: () => void;
};

// focus trap behavior adapted from Radix UI FocusScope (MIT) for this Preact runtime.
const focusScopesStack = (() => {
  let stack: FocusScope[] = [];

  const remove = (focusScope: FocusScope) => stack.filter((scope) => scope !== focusScope);

  return {
    add: (focusScope: FocusScope) => {
      const activeFocusScope = stack[0];
      if (focusScope !== activeFocusScope) {
        activeFocusScope?.pause();
      }

      stack = remove(focusScope);
      stack.unshift(focusScope);
    },
    remove: (focusScope: FocusScope) => {
      stack = remove(focusScope);
      stack[0]?.resume();
    },
  };
})();

const focus = (element?: FocusableTarget | null, { select = false } = {}) => {
  if (!element?.focus) return;

  const previouslyFocusedElement = document.activeElement;
  element.focus({ preventScroll: true });

  if (
    element !== previouslyFocusedElement &&
    element instanceof HTMLInputElement &&
    "select" in element &&
    select
  ) {
    element.select();
  }
};

const focusFirst = (candidates: HTMLElement[], { select = false } = {}) => {
  const previouslyFocusedElement = document.activeElement;

  for (const candidate of candidates) {
    focus(candidate, { select });
    if (document.activeElement !== previouslyFocusedElement) return;
  }
};

const isHidden = (node: HTMLElement, upTo: HTMLElement) => {
  if (getComputedStyle(node).visibility === "hidden") return true;

  let currentNode: HTMLElement | null = node;
  while (currentNode) {
    if (currentNode === upTo) return false;
    if (getComputedStyle(currentNode).display === "none") return true;
    currentNode = currentNode.parentElement;
  }

  return false;
};

const isDisabledFormControl = (element: HTMLElement) =>
  (element instanceof HTMLButtonElement ||
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLOptGroupElement ||
    element instanceof HTMLOptionElement ||
    element instanceof HTMLFieldSetElement) &&
  element.disabled;

const getTabbableCandidates = (container: HTMLElement) => {
  const nodes: HTMLElement[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      const element = node as HTMLElement;
      const isHiddenInput = element.tagName === "INPUT" && (element as HTMLInputElement).type === "hidden";

      if (element.closest("[inert]")) return NodeFilter.FILTER_REJECT;
      if (element.closest("fieldset[disabled]")) return NodeFilter.FILTER_REJECT;
      if (element.hidden || isHidden(element, container)) return NodeFilter.FILTER_REJECT;
      if (isDisabledFormControl(element) || isHiddenInput) return NodeFilter.FILTER_SKIP;

      return element.tabIndex >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });

  while (walker.nextNode()) {
    nodes.push(walker.currentNode as HTMLElement);
  }

  return nodes;
};

const getTabbableEdges = (container: HTMLElement) => {
  const candidates = getTabbableCandidates(container);
  const first = candidates[0];
  const last = candidates.at(-1);

  return [first, last] as const;
};

export const useFocusTrap = <TElement extends HTMLElement>({
  enabled,
  onEscapeKeyDown,
}: UseFocusTrapOptions): MutableRef<TElement | null> => {
  const containerRef = useRef<TElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const onEscapeKeyDownRef = useRef(onEscapeKeyDown);
  const focusScopeRef = useRef<FocusScope>({
    paused: false,
    pause() {
      this.paused = true;
    },
    resume() {
      this.paused = false;
    },
  });

  useEffect(() => {
    // Keep the latest escape handler without re-running the main trap effect.
    onEscapeKeyDownRef.current = onEscapeKeyDown;
  }, [onEscapeKeyDown]);

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const focusScope = focusScopeRef.current;
    const previouslyFocusedElement = document.activeElement as HTMLElement | null;
    const previousTabIndex = container.getAttribute("tabindex");
    let isUnmounting = false;

    if (previousTabIndex === null) {
      container.setAttribute("tabindex", "-1");
    }

    focusScopesStack.add(focusScope);

    if (!container.contains(previouslyFocusedElement)) {
      focusFirst(getTabbableCandidates(container), { select: true });

      if (document.activeElement === previouslyFocusedElement) {
        focus(container);
      }
    }

    if (container.contains(document.activeElement)) {
      lastFocusedElementRef.current = document.activeElement as HTMLElement;
    }

    const focusLastElementInsideContainer = () => {
      const [firstFocusableElement] = getTabbableEdges(container);
      const lastFocusedElement =
        lastFocusedElementRef.current && container.contains(lastFocusedElementRef.current)
          ? lastFocusedElementRef.current
          : null;

      focus(lastFocusedElement ?? firstFocusableElement ?? container, { select: true });
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (focusScope.paused) return;

      const target = event.target as HTMLElement | null;
      if (target && container.contains(target)) {
        lastFocusedElementRef.current = target;
        return;
      }

      focusLastElementInsideContainer();
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (focusScope.paused) return;

      const relatedTarget = event.relatedTarget as HTMLElement | null;
      if (relatedTarget && !container.contains(relatedTarget)) {
        focusLastElementInsideContainer();
        return;
      }

      if (relatedTarget === null) {
        setTimeout(() => {
          if (!isUnmounting && !container.contains(document.activeElement)) {
            focusLastElementInsideContainer();
          }
        }, 0);
      }
    };

    const handleMutations = () => {
      if (!container.contains(document.activeElement)) {
        focusLastElementInsideContainer();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (focusScope.paused) return;

      const hasModifierKey = event.altKey || event.ctrlKey || event.metaKey;
      if (event.key === "Escape" && !hasModifierKey && onEscapeKeyDownRef.current) {
        event.preventDefault();
        onEscapeKeyDownRef.current();
        return;
      }

      const isTabKey = event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey;
      if (!isTabKey) return;

      const focusedElement = document.activeElement as HTMLElement | null;
      const [firstFocusableElement, lastFocusableElement] = getTabbableEdges(container);

      if (!firstFocusableElement || !lastFocusableElement) {
        if (focusedElement === container) {
          event.preventDefault();
        }
        return;
      }

      if (!event.shiftKey && focusedElement === lastFocusableElement) {
        event.preventDefault();
        focus(firstFocusableElement, { select: true });
        return;
      }

      if (event.shiftKey && focusedElement === firstFocusableElement) {
        event.preventDefault();
        focus(lastFocusableElement, { select: true });
      }
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    document.addEventListener("keydown", handleKeyDown);

    const mutationObserver = new MutationObserver(handleMutations);
    mutationObserver.observe(container, { childList: true, subtree: true });

    return () => {
      isUnmounting = true;
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("keydown", handleKeyDown);
      mutationObserver.disconnect();
      focusScopesStack.remove(focusScope);

      if (previousTabIndex === null) {
        container.removeAttribute("tabindex");
      }

      setTimeout(() => {
        if (previouslyFocusedElement?.isConnected) {
          focus(previouslyFocusedElement, { select: true });
        }
      }, 0);
    };
  }, [enabled]);

  return containerRef;
};
