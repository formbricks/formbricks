"use client";

import { cn } from "@/lib/cn";

interface ProgressBarProps {
  progress: number;
  barColor: string;
  height?: 2 | 5;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, barColor, height = 5 }) => {
  const heightClass = () => {
    switch (height) {
      case 2:
        return "h-2";
      case 5:
        return "h-5";
      default:
        return "";
    }
  };

  const maxWidth = Math.floor(Math.max(0, Math.min(progress, 1)) * 100);

  return (
    <div className={cn(heightClass(), "w-full rounded-full bg-slate-200")}>
      <div
        className={cn("h-full rounded-full", barColor)}
        style={{ width: `${maxWidth}%`, transition: "width 0.5s ease-out" }}></div>
    </div>
  );
};

interface HalfCircleProps {
  value: number;
}

export const HalfCircle: React.FC<HalfCircleProps> = ({ value }: { value: number }) => {
  const normalizedValue = (value + 100) / 200;
  const mappedValue = (normalizedValue * 180 - 180).toString() + "deg";

  return (
    <div className="w-fit">
      <div className="relative flex h-28 w-52 items-end justify-center overflow-hidden">
        <div className="absolute h-24 w-48 origin-bottom rounded-tl-full rounded-tr-full bg-slate-200"></div>
        <div
          className="bg-brand-dark absolute h-24 w-48 origin-bottom rounded-tl-full rounded-tr-full"
          style={{ rotate: mappedValue }}></div>
        <div className="absolute h-20 w-40 rounded-tl-full rounded-tr-full bg-white"></div>
      </div>
      <div className="flex justify-between text-sm leading-10 text-slate-600">
        <p>-100</p>
        <p className="text-2xl text-black md:text-4xl">{Math.round(value)}</p>
        <p>100</p>
      </div>
    </div>
  );
};
