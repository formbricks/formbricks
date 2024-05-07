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
    <div className="relative pt-6">
      {!isAtTop && (
        <div className="from-survey-bg absolute left-0 right-2 top-6 z-10 h-4 bg-gradient-to-b to-transparent"></div>
      )}
      <div
        ref={containerRef}
        style={{
          scrollbarGutter: "stable both-edges",
          maxHeight: isSurveyPreview ? "40dvh" : "60dvh",
        }}
        className={`overflow-${isOverflowHidden ? "hidden" : "auto"} px-4 pb-1`}
        onMouseEnter={() => toggleOverflow(false)}
        onTouchStart={() => toggleOverflow(false)}
        onTouchEnd={() => toggleOverflow(true)}
        onMouseLeave={() => toggleOverflow(true)}>
        {children}
      </div>
      {!isAtBottom && (
        <div className="from-survey-bg absolute -bottom-2 left-0 right-2 h-8 bg-gradient-to-t to-transparent"></div>
      )}
    </div>
  );
};
