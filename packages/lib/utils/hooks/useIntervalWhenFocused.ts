import { useEffect, useRef } from "react";

export const useIntervalWhenFocused = (
  callback: () => void,
  intervalDuration: number,
  isActive: boolean,
  shouldExecuteImmediately = true
) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleFocus = () => {
    if (isActive) {
      if (shouldExecuteImmediately) {
        // Execute the callback immediately when the tab comes into focus
        callback();
      }

      // Set the interval to execute the callback every `intervalDuration` milliseconds
      intervalRef.current = setInterval(() => {
        callback();
      }, intervalDuration);
    }
  };

  const handleBlur = () => {
    // Clear the interval when the tab loses focus
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    // Attach focus and blur event listeners
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    // Handle initial focus
    handleFocus();

    // Cleanup interval and event listeners when the component unmounts or dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isActive, intervalDuration]);
};

export default useIntervalWhenFocused;
