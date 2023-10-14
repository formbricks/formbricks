import { useState, useEffect, useCallback } from "react";
import { HiOutlineArrowUp } from "react-icons/hi2";
import throttle from "lodash/throttle";
import { Button } from "@formbricks/ui/Button";

const ScrollToTopButton = () => {
  const [visible, setVisible] = useState(false);

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    const toggleVisible = () => {
      const scrolled = document.documentElement.scrollTop;
      if (scrolled > 500) {
        setVisible(true);
      } else if (scrolled <= 500) {
        setVisible(false);
      }
    };

    const throttledToggleVisible = throttle(toggleVisible, 200);

    window.addEventListener("scroll", throttledToggleVisible);

    return () => window.removeEventListener("scroll", throttledToggleVisible);
  }, []);

  return (
    <div className="fixed bottom-20 right-10 z-50" style={{ display: visible ? "inline" : "none" }}>
      <Button
        className={"flex w-12 items-center justify-center px-1 py-2 opacity-50 hover:opacity-100"}
        onClick={scrollToTop}>
        <HiOutlineArrowUp size={25} />
      </Button>
    </div>
  );
};

export default ScrollToTopButton;
