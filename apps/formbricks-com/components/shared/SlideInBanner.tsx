import LFGLuigi from "@/images/blog/lfg-luigi-200px.webp";
import { Button } from "@formbricks/ui/Button";
import Image from "next/image";
import React, { useEffect, useState } from "react";

interface Props {
  delay?: number; // in milliseconds, optional
  scrollPercentage?: number; // optional
  UTMSource: string; // required
}

const SlideInBanner: React.FC<Props> = ({ delay = 5000, scrollPercentage = 10, UTMSource }) => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
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
  }, [delay, scrollPercentage]);

  return (
    <div
      className={`sticky bottom-4 grid grid-cols-7 rounded-lg bg-slate-700 bg-opacity-70 p-4 text-white backdrop-blur-sm transition-all duration-500 ease-out ${
        showBanner ? "visible translate-y-0 opacity-100" : "invisible translate-y-full opacity-0"
      }`}>
      <div className="relative col-span-1 hidden lg:block">
        <Image src={LFGLuigi} height={150} className="absolute -bottom-16 left-8" alt="LFG Luigi" />
      </div>
      <div className="col-span-7 flex items-center space-x-3 lg:col-span-6">
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
      </div>
    </div>
  );
};

export default SlideInBanner;
