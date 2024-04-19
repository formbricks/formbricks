import { useRef, useState } from "preact/hooks";

interface ScrollableContainerProps {
  children: JSX.Element;
}

export const ScrollableContainer = ({ children }: ScrollableContainerProps) => {
  const [overflow, setOverflow] = useState("hidden");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setOverFlowToAuto = () => {
    // Clear any existing timeout to prevent hiding the scrollbar unexpectedly
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setOverflow("auto");
  };

  const setOverFlowToHidden = () => {
    // Clear previous timeout before setting a new one
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setOverflow("hidden");
    }, 1500);
  };

  return (
    <div
      style={{ scrollbarGutter: "stable" }}
      className={`overflow-${overflow} max-h-[40vh] p-5`}
      onMouseEnter={setOverFlowToAuto}
      onTouchStart={setOverFlowToAuto}
      onTouchEnd={setOverFlowToHidden}
      onMouseLeave={setOverFlowToHidden}>
      {children}
    </div>
  );
};
