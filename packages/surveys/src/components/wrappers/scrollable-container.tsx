import type { JSX, Ref } from "preact";
import { forwardRef } from "preact/compat";
import { useEffect, useImperativeHandle, useRef, useState } from "preact/hooks";
import { ChevronDownIcon } from "@/components/icons/chevron-down-icon";
import { cn } from "@/lib/utils";

interface ScrollableContainerProps {
  children: JSX.Element;
  fullSizeCards: boolean;
}

export interface ScrollableContainerHandle {
  scrollToBottom: () => void;
}

export const ScrollableContainer = forwardRef<ScrollableContainerHandle, ScrollableContainerProps>(
  ({ children, fullSizeCards = false }: ScrollableContainerProps, ref: Ref<ScrollableContainerHandle>) => {
    const [isAtBottom, setIsAtBottom] = useState(false);
    const [isAtTop, setIsAtTop] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const isSurveyPreview = Boolean(document.getElementById("survey-preview"));

    const checkScroll = () => {
      if (!containerRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;

      // Use a small tolerance to account for zoom-related precision issues
      const tolerance = 1;

      // Check if at bottom with tolerance
      setIsAtBottom(scrollTop + clientHeight >= scrollHeight - tolerance);

      // Check if at top with tolerance
      setIsAtTop(scrollTop <= tolerance);
    };

    const scrollToBottom = () => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    };

    // Expose only the `scrollToBottom` method to parent components via the forwarded ref
    useImperativeHandle(ref, () => ({
      scrollToBottom,
    }));

    useEffect(() => {
      const element = containerRef.current;
      if (!element) return;

      const handleScroll = () => {
        checkScroll();
      };
      element.addEventListener("scroll", handleScroll);

      return () => {
        element.removeEventListener("scroll", handleScroll);
      };
    }, []);

    useEffect(() => {
      checkScroll();
    }, [children]);

    let maxHeight: string;
    if (fullSizeCards) {
      maxHeight = "calc(100vh - 6rem)";
    } else if (isSurveyPreview) {
      maxHeight = "42dvh";
    } else {
      maxHeight = "60dvh";
    }

    return (
      <div className="relative">
        {!isAtTop && (
          <div className="from-survey-bg absolute top-0 right-2 left-0 z-10 h-4 bg-linear-to-b to-transparent" />
        )}
        <div
          ref={containerRef}
          style={{
            maxHeight,
          }}
          className={cn("bg-survey-bg overflow-auto px-4")}>
          {children}
        </div>
        {!isAtBottom && (
          <>
            <div className="from-survey-bg absolute right-4 bottom-0 left-4 h-4 bg-linear-to-t to-transparent" />
            <button
              type="button"
              onClick={scrollToBottom}
              style={{ transform: "translateX(-50%)" }}
              className="bg-survey-bg hover:border-border focus:ring-brand absolute bottom-2 left-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-transparent shadow-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
              aria-label="Scroll to bottom">
              <ChevronDownIcon className="text-heading h-5 w-5" />
            </button>
          </>
        )}
      </div>
    );
  }
);
