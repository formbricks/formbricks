import type { JSX, Ref } from "preact";
import { forwardRef } from "preact/compat";
import { useEffect, useImperativeHandle, useRef, useState } from "preact/hooks";
import { ScrollToBottomButton } from "@/components/buttons/scroll-to-bottom-button";
import { cn } from "@/lib/utils";

interface ScrollableContainerProps {
  children: JSX.Element;
  fullSizeCards: boolean;
  disableInternalScroll?: boolean;
}

export interface ScrollableContainerHandle {
  scrollToBottom: () => void;
}

export const ScrollableContainer = forwardRef<ScrollableContainerHandle, ScrollableContainerProps>(
  (
    { children, fullSizeCards = false, disableInternalScroll = false }: Readonly<ScrollableContainerProps>,
    ref: Ref<ScrollableContainerHandle>
  ) => {
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

    let maxHeight: string | undefined;
    if (disableInternalScroll) {
      maxHeight = undefined;
    } else if (fullSizeCards) {
      maxHeight = "calc(100vh - 6rem)";
    } else if (isSurveyPreview) {
      maxHeight = "42dvh";
    } else {
      maxHeight = "60dvh";
    }

    return (
      <div className="relative">
        {!disableInternalScroll && !isAtTop && (
          // Solid for --fb-scroll-fade-solid (set while the close button floats over the content), then
          // the usual 16px fade; unset, it is the plain fade.
          <div className="absolute top-0 right-2 left-0 z-10 h-[calc(var(--fb-scroll-fade-solid,0px)+1rem)] bg-[linear-gradient(to_bottom,var(--fb-survey-background-color)_var(--fb-scroll-fade-solid,0px),transparent)]" />
        )}
        <div
          ref={containerRef}
          style={{
            maxHeight,
          }}
          // The scroll padding matches the top band, solid part and fade, so an option scrolled into view
          // by keyboard focus lands below it instead of underneath.
          className={cn(
            disableInternalScroll
              ? "overflow-visible"
              : "bg-survey-bg [scroll-padding-top:calc(var(--fb-scroll-fade-solid,0px)+1rem)] overflow-auto px-4 pt-4",
            // The sticky Back/Next row overlays the bottom of the content; keep a focused field above it.
            !disableInternalScroll && fullSizeCards && "[scroll-padding-bottom:6rem]"
          )}>
          {children}
        </div>
        {!disableInternalScroll && !isAtBottom && (
          <>
            <div className="from-survey-bg absolute right-4 bottom-0 left-4 h-4 bg-linear-to-t to-transparent" />
            <ScrollToBottomButton onClick={scrollToBottom} />
          </>
        )}
      </div>
    );
  }
);
