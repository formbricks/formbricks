import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  children: any;
  content?: string;
}

export function Tooltip({ children, content }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 12,
        left: rect.left + rect.width / 2,
      });
    }
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition);
    }
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [isVisible]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        tabIndex={content ? 0 : -1}
        role={content ? "button" : undefined}
        aria-describedby={content && isVisible ? "tooltip" : undefined}
        className="z-100 relative inline-block">
        {children}
      </div>

      {isVisible &&
        createPortal(
          (
            <div
              style={{
                position: "absolute",
                top: position.top,
                left: position.left,
                transform: "translateX(-50%) translateY(-100%)",
                marginBottom: "8px",
                zIndex: 1050,
              }}
              className="fb-max-w-7xl z-50 whitespace-normal rounded-md border border-gray-200 bg-white px-3 py-1 text-xs font-light shadow-md">
              {content}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-4 border-transparent border-b-white" />
            </div>
          ) as any,
          document.body
        )}
    </>
  );
}
