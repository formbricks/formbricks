import { type RefObject, useLayoutEffect, useState } from "react";

/** The width of an element, kept current as the host resizes the view. `fallback` is used until measured. */
export const useElementWidth = (ref: RefObject<HTMLElement | null>, fallback = 560): number => {
  const [width, setWidth] = useState(fallback);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => {
      const next = Math.floor(element.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
};
