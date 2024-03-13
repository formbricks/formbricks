import throttle from "lodash/throttle";
import { ArrowUpIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
        className="flex w-12 items-center justify-center bg-slate-900/10 px-1 py-2 hover:bg-slate-900/20 hover:opacity-100 dark:bg-slate-50/5 dark:hover:bg-slate-50/30"
        onClick={scrollToTop}>
        <ArrowUpIcon className="h-6 w-6 text-slate-900 dark:text-slate-50" />
      </Button>
    </div>
  );
};

export default ScrollToTopButton;
