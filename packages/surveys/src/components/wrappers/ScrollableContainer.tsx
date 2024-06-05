import { cn } from "@/lib/utils";
import { MutableRef, useEffect, useRef, useState } from "preact/hooks";

interface ScrollableContainerProps {
  children: JSX.Element;
  loadingElement: boolean;
  contentRef: MutableRef<HTMLDivElement | null>;
}

export const ScrollableContainer = ({ children, loadingElement, contentRef }: ScrollableContainerProps) => {
  const [isOverflowHidden, setIsOverflowHidden] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [isAtTop, setIsAtTop] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkScroll = () => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;

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
    const element = contentRef.current;
    if (!element) return;
    console.log("running");
    element.scrollTop = 0;

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
    <div className={cn("relative h-[85%] pt-6", loadingElement ? "animate-pulse opacity-60" : "")}>
      {!isAtTop && (
        <div className="from-survey-bg absolute left-0 right-2 top-6 z-10 h-4 bg-gradient-to-b to-transparent"></div>
      )}
      <div
        ref={contentRef}
        style={{
          scrollbarGutter: "stable both-edges",
        }}
        className={cn(" h-full overflow-auto px-4 pb-1", isOverflowHidden ? "no-scrollbar" : "bg-survey-bg")}
        onMouseEnter={() => toggleOverflow(false)}
        onMouseLeave={() => toggleOverflow(true)}>
        {children}
      </div>
      {!isAtBottom && (
        <div className="from-survey-bg absolute -bottom-2 left-0 right-2 h-8 bg-gradient-to-t to-transparent"></div>
      )}
    </div>
  );
};
