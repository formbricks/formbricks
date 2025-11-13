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
      <div className="fb-relative">
        {!isAtTop && (
          <div className="fb-from-survey-bg fb-absolute fb-left-0 fb-right-2 fb-top-0 fb-z-10 fb-h-4 fb-bg-gradient-to-b fb-to-transparent" />
        )}
        <div
          ref={containerRef}
          style={{
            maxHeight,
          }}
          className={cn("fb-overflow-auto fb-px-4 fb-bg-survey-bg")}>
          {children}
        </div>
        {!isAtBottom && (
          <>
            <div className="fb-from-survey-bg fb-absolute fb-bottom-0 fb-left-4 fb-right-4 fb-h-4 fb-bg-gradient-to-t fb-to-transparent" />
            <button
              type="button"
              onClick={scrollToBottom}
              style={{ transform: "translateX(-50%)" }}
              className="fb-absolute fb-bottom-2 fb-left-1/2 fb-z-20 fb-flex fb-h-8 fb-w-8 fb-items-center fb-justify-center fb-rounded-full fb-bg-survey-bg fb-border fb-border-transparent hover:fb-border-border fb-shadow-lg fb-transition-colors focus:fb-ring-2 focus:fb-outline-none focus:fb-ring-brand focus:fb-ring-offset-2"
              aria-label="Scroll to bottom">
              <ChevronDownIcon className="fb-text-heading fb-w-5 fb-h-5" />
            </button>
          </>
        )}
      </div>
    );
  }
);
