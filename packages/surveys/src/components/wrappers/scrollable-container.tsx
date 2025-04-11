import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { cn } from "../../lib/utils";

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
    <div className="relative">
      {!isAtTop && (
        <div className="from-survey-bg absolute left-0 right-2 top-0 z-10 h-6 bg-gradient-to-b to-transparent" />
      )}
      <div
        ref={containerRef}
        style={{
          scrollbarGutter: "stable both-edges",
          maxHeight: isSurveyPreview ? "42dvh" : "60dvh",
        }}
        className={cn("bg-survey-bg overflow-auto px-4 pb-4")}>
        {children}
      </div>
      {!isAtBottom && (
        <div className="from-survey-bg absolute -bottom-2 left-0 right-2 h-8 bg-gradient-to-t to-transparent" />
      )}
    </div>
  );
}
