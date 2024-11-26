import { useEffect, useRef } from "react";

interface HeadingElement extends IntersectionObserverEntry {
  target: HTMLHeadingElement;
}

/**
 * A custom hook that sets up an IntersectionObserver to track the visibility of headings on the page.
 *
 * @param {Function} setActiveId - A function to set the active heading ID.
 * @param {string} pathname - The current pathname, used as a dependency for the useEffect hook.
 * @returns {void}
 *
 * This hook performs the following tasks:
 * 1. Creates a map of heading elements, where the key is the heading's ID and the value is the heading element.
 * 2. Finds the visible headings (i.e., headings that are currently intersecting with the viewport).
 * 3. If there is only one visible heading, sets it as the active heading using the `setActiveId` function.
 * 4. If there are multiple visible headings, sets the active heading to the one that is highest on the page (i.e., the one with the lowest index in the `headingElements` array).
 * 5. Cleans up the IntersectionObserver and the `headingElementsRef` when the component is unmounted.
 */
export const useTableContentObserver = (setActiveId: (id: string) => void, pathname: string) => {
  const headingElementsRef = useRef<Record<string, HeadingElement>>({});

  useEffect(() => {
    const callback = (headings: HeadingElement[]) => {
      // Create a map of heading elements, where the key is the heading's ID and the value is the heading element
      headingElementsRef.current = headings.reduce(
        (map, headingElement) => {
          return { ...map, [headingElement.target.id]: headingElement };
        },
        {} as Record<string, HeadingElement>
      );

      // Find the visible headings (i.e., headings that are currently intersecting with the viewport)
      const visibleHeadings: HeadingElement[] = [];
      Object.keys(headingElementsRef.current).forEach((key) => {
        const headingElement = headingElementsRef.current[key];
        if (headingElement.isIntersecting) visibleHeadings.push(headingElement);
      });

      // Define a function to get the index of a heading element in the headingElements array
      const getIndexFromId = (id: string) => headingElements.findIndex((heading) => heading.id === id);

      // If there is only one visible heading, set it as the active heading
      if (visibleHeadings.length === 1) {
        setActiveId(visibleHeadings[0].target.id);
      }
      // If there are multiple visible headings, set the active heading to the one that is highest on the page
      else if (visibleHeadings.length > 1) {
        const sortedVisibleHeadings = visibleHeadings.sort((a, b) => {
          const aIndex = getIndexFromId(a.target.id);
          const bIndex = getIndexFromId(b.target.id);
          return aIndex - bIndex;
        });
        setActiveId(sortedVisibleHeadings[0].target.id);
      }
    };

    const observer = new IntersectionObserver(callback, {
      rootMargin: "-40px 0px -40% 0px",
    });

    const headingElements = Array.from(document.querySelectorAll("h2[id], h3[id], h4[id]"));
    headingElements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      headingElementsRef.current = {};
    };
  }, [setActiveId, pathname]);
};
