"use client";

import { useEffect, useState } from "react";

interface ScrollToTopProps {
  containerId: string; // ID of the scrollable container
}

const ScrollToTop: React.FC<ScrollToTopProps> = ({ containerId }) => {
  const [showButton, setShowButton] = useState<boolean>(false);

  // Show the button when scrolling down
  useEffect(() => {
    const container = document.getElementById(containerId);

    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop > 300) {
        setShowButton(true);
      } else {
        setShowButton(false);
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [containerId]);

  // Scroll to top function
  const scrollToTop = (): void => {
    const container = document.getElementById(containerId);
    if (container) {
      container.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-4 right-4 z-[1] flex h-10 w-10 justify-center rounded-md bg-slate-500 p-2 text-white transition-opacity ${
        showButton ? "opacity-80" : "opacity-0"
      }`}>
      ↑
    </button>
  );
};

export default ScrollToTop;
