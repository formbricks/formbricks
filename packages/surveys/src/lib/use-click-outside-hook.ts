import { MutableRef, useEffect } from "preact/hooks";

// Helper function to check if a value is a DOM element with contains method
const isDOMElement = (element: any): element is HTMLElement => {
  return element && typeof element.contains === "function" && element.nodeType === Node.ELEMENT_NODE;
};

// Improved version of https://usehooks.com/useOnClickOutside/
export const useClickOutside = (
  ref: MutableRef<HTMLElement | null>,
  handler: (event: MouseEvent | TouchEvent) => void
): void => {
  useEffect(() => {
    let startedInside = false;
    let startedWhenMounted = false;

    const listener = (event: MouseEvent | TouchEvent) => {
      // Do nothing if `mousedown` or `touchstart` started inside ref element
      if (startedInside || !startedWhenMounted) return;
      // Do nothing if clicking ref's element or descendent elements
      if (!isDOMElement(ref.current) || ref.current.contains(event.target as Node)) return;

      handler(event);
    };

    const validateEventStart = (event: MouseEvent | TouchEvent) => {
      startedWhenMounted = isDOMElement(ref.current);
      startedInside = isDOMElement(ref.current) && ref.current.contains(event.target as Node);
    };

    document.addEventListener("mousedown", validateEventStart);
    document.addEventListener("touchstart", validateEventStart);
    document.addEventListener("click", listener);

    return () => {
      document.removeEventListener("mousedown", validateEventStart);
      document.removeEventListener("touchstart", validateEventStart);
      document.removeEventListener("click", listener);
    };
  }, [ref, handler]);
};
