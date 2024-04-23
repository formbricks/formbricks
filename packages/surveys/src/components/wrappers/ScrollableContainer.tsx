import { useEffect, useRef, useState } from "preact/hooks";

interface ScrollableContainerProps {
  children: JSX.Element;
}

export const ScrollableContainer = ({ children }: ScrollableContainerProps) => {
  const [isOverflowHidden, setIsOverflowHidden] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSurveyPreview = !!document.getElementById("survey-preview");

  const checkScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setIsAtBottom(Math.round(scrollTop) + clientHeight >= scrollHeight);
  };

  const toggleOverflow = (hide: boolean) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (hide) {
      timeoutRef.current = setTimeout(() => setIsOverflowHidden(true), 1500);
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
    <div className="relative">
      <div
        ref={containerRef}
        style={{
          scrollbarGutter: "stable",
          maxHeight: isSurveyPreview ? "40vh" : "60vh",
        }}
        className={`overflow-${isOverflowHidden ? "hidden" : "auto"} p-5`}
        onMouseEnter={() => toggleOverflow(false)}
        onTouchStart={() => toggleOverflow(false)}
        onTouchEnd={() => toggleOverflow(true)}
        onMouseLeave={() => toggleOverflow(true)}>
        {children}
      </div>
      {!isAtBottom && (
        <div className="from-survey-bg absolute -bottom-2 left-0 right-2 h-16 bg-gradient-to-t to-transparent"></div>
      )}
    </div>
  );
};
