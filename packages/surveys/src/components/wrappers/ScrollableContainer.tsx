import { useEffect, useRef, useState } from "preact/hooks";

interface ScrollableContainerProps {
  children: JSX.Element;
}

export const ScrollableContainer = ({ children }: ScrollableContainerProps) => {
  const [overflow, setOverflow] = useState("hidden");
  const [isAtBottom, setIsAtBottom] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setOverFlowToAuto = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setOverflow("auto");
    checkScroll(); // Check scroll position every time the overflow is set to auto
  };

  const setOverFlowToHidden = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setOverflow("hidden");
    }, 1500);
  };

  const checkScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      setIsAtBottom(Math.round(scrollTop) + clientHeight >= scrollHeight);
    }
  };

  useEffect(() => {
    checkScroll();
    const element = containerRef.current;
    if (element) {
      element.addEventListener("scroll", checkScroll);
    }

    return () => {
      if (element) {
        element.removeEventListener("scroll", checkScroll);
      }
    };
  }, []);

  useEffect(() => {
    checkScroll();
  }, [children]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        style={{ scrollbarGutter: "stable" }}
        className={`overflow-${overflow} max-h-[40vh] p-5`}
        onMouseEnter={setOverFlowToAuto}
        onTouchStart={setOverFlowToAuto}
        onTouchEnd={setOverFlowToHidden}
        onMouseLeave={setOverFlowToHidden}>
        {children}
      </div>
      {!isAtBottom && (
        <div className="from-survey-bg absolute bottom-0 left-0 right-2 h-16 bg-gradient-to-t from-40% to-transparent"></div>
      )}
    </div>
  );
};
