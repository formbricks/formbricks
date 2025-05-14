import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "react";

interface ScrollableContainerProps {
  children: JSX.Element;
}

export function ScrollableContainer({ children }: ScrollableContainerProps) {
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [isAtTop, setIsAtTop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isSurveyPreview = Boolean(document.getElementById("survey-preview"));

  const checkScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;

    setIsAtBottom(Math.round(scrollTop) + clientHeight >= scrollHeight);

    setIsAtTop(scrollTop === 0);
  };

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

  return (
    <div className="fb-relative">
      {!isAtTop && (
        <div className="fb-from-survey-bg fb-absolute fb-left-0 fb-right-2 fb-top-0 fb-z-10 fb-h-6 fb-bg-gradient-to-b fb-to-transparent" />
      )}
      <div
        id="scrollable-container"
        ref={containerRef}
        style={{
          scrollbarGutter: "stable both-edges",
          maxHeight: isSurveyPreview ? "48dvh" : "60dvh",
        }}
        className={cn("fb-overflow-auto fb-px-4 fb-pb-4 fb-bg-survey-bg")}>
        {children}
      </div>
      {!isAtBottom && (
        <div className="fb-from-survey-bg fb-absolute -fb-bottom-2 fb-left-0 fb-right-2 fb-h-8 fb-bg-gradient-to-t fb-to-transparent" />
      )}
    </div>
  );
}
