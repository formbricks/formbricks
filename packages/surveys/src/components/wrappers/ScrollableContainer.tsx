import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "preact/hooks";

interface ScrollableContainerProps {
  children: JSX.Element;
}

export const ScrollableContainer = ({ children }: ScrollableContainerProps) => {
  const [isOverflowHidden, setIsOverflowHidden] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [isAtTop, setIsAtTop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSurveyPreview = !!document.getElementById("survey-preview");

  const checkScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;

    setIsAtBottom(Math.round(scrollTop) + clientHeight >= scrollHeight);

    setIsAtTop(scrollTop === 0);
  };

  const toggleOverflow = (hide: boolean) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (hide) {
      timeoutRef.current = setTimeout(() => setIsOverflowHidden(true), 1000);
    } else {
      setIsOverflowHidden(false);
      checkScroll();
    }
  };

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handleScroll = () => checkScroll();
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
        <div className="fb-from-survey-bg fb-absolute fb-left-0 fb-right-2 fb-top-0 fb-z-10 fb-h-4 fb-bg-gradient-to-b fb-to-transparent"></div>
      )}
      <div
        ref={containerRef}
        style={{
          scrollbarGutter: "stable both-edges",
          maxHeight: isSurveyPreview ? "40dvh" : "60dvh",
        }}
        className={cn(
          "fb-overflow-auto fb-px-4 fb-pb-1",
          isOverflowHidden ? "fb-no-scrollbar" : "fb-bg-survey-bg"
        )}
        onMouseEnter={() => toggleOverflow(false)}
        onMouseLeave={() => toggleOverflow(true)}>
        {children}
      </div>
      {!isAtBottom && (
        <div className="fb-from-survey-bg fb-absolute -fb-bottom-2 fb-left-0 fb-right-2 fb-h-8 fb-bg-gradient-to-t fb-to-transparent"></div>
      )}
    </div>
  );
};
