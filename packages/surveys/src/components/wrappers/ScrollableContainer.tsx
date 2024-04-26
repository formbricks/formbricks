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

  // checking the browser because of the scrollbar issue in chrome
  const isChrome =
    !!(window as any).chrome && ((window as any).chrome.webstore || (window as any).chrome.runtime);

  const checkScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setIsAtBottom(Math.round(scrollTop) + clientHeight >= scrollHeight);
    setIsAtTop(scrollTop === 0);
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

  const disableBodyScroll = () => {
    document.body.style.overflow = "hidden";
  };

  const enableBodyScroll = () => {
    document.body.style.overflow = "";
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
    <div className="relative pt-4 sm:pt-6">
      {!isAtTop && (
        <div className="from-survey-bg absolute left-0 right-2 top-4 z-10 h-4 bg-gradient-to-b to-transparent sm:top-6"></div>
      )}
      <div
        ref={containerRef}
        style={{
          scrollbarGutter: isChrome ? "stable" : "auto",
          maxHeight: isSurveyPreview ? "40dvh" : "60dvh",
        }}
        className={`overflow-${isOverflowHidden ? "hidden" : "auto"} ${isChrome ? "pr-2 sm:pr-4" : "pr-4 sm:pr-6"} pb-1 pl-4 sm:pl-6 `}
        onMouseEnter={() => toggleOverflow(false)}
        onTouchStart={() => {
          toggleOverflow(false);
          disableBodyScroll();
        }}
        onTouchEnd={() => {
          toggleOverflow(true);
          enableBodyScroll();
        }}
        onTouchCancel={() => enableBodyScroll()}
        onMouseLeave={() => toggleOverflow(true)}>
        {children}
      </div>
      {!isAtBottom && (
        <div className="from-survey-bg absolute -bottom-2 left-0 right-2 h-8 bg-gradient-to-t to-transparent"></div>
      )}
    </div>
  );
};
