import LFGLuigi from "@/images/blog/lfg-luigi-200px.webp";
import { XIcon } from "lucide-react";
import Image from "next/image";
import React, { useEffect, useState } from "react";

import { Button } from "@formbricks/ui/Button";

interface Props {
  delay?: number;
  scrollPercentage?: number;
  UTMSource: string;
}

const SlideInBanner: React.FC<Props> = ({ delay = 5000, scrollPercentage = 10, UTMSource }) => {
  const [showBanner, setShowBanner] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (isDismissed) return;

    const timer = setTimeout(() => {
      setShowBanner(true);
    }, delay);

    const handleScroll = () => {
      let currentScrollPercentage =
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      if (currentScrollPercentage > scrollPercentage) {
        setShowBanner(true);
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [delay, scrollPercentage, isDismissed]);

  if (isDismissed) return null;

  return (
    <div
      className={`lg:gird-cols-6 relative sticky bottom-4 grid rounded-lg bg-slate-700 bg-opacity-70 p-4 text-white backdrop-blur-sm transition-all duration-500 ease-out lg:grid-cols-7 ${
        showBanner && !isExiting
          ? "visible translate-y-0 opacity-100"
          : isExiting
            ? "visible translate-y-full opacity-0"
            : "invisible translate-y-full opacity-0"
      }`}>
      <div className="relative col-span-1 hidden lg:block">
        <Image src={LFGLuigi} height={150} className="absolute -bottom-16 left-8" alt="LFG Luigi" />
      </div>
      <div className="col-span-6 flex items-center space-x-3">
        <p>
          Did you know? Formbricks is the only open source Experience Management solution: free &
          privacy-first!
        </p>
        <Button
          size="sm"
          href={`https://formbricks.com?utm_source=${UTMSource}`}
          className="whitespace-nowrap">
          Learn more
        </Button>
        <button
          onClick={() => {
            setIsExiting(true);
            setTimeout(() => setIsDismissed(true), 500);
          }}
          className="rounded-full p-2 hover:bg-slate-600 hover:bg-opacity-30">
          <XIcon className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};

export default SlideInBanner;
