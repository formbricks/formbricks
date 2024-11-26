"use client";

import { TCardArrangementOptions } from "@formbricks/types/styling";

interface StackedCardsContainerProps {
  children: React.ReactNode;
  cardArrangement: TCardArrangementOptions;
}

export const StackedCardsContainer: React.FC<StackedCardsContainerProps> = ({
  children,
  cardArrangement,
}) => {
  switch (cardArrangement) {
    case "casual":
      return (
        <div className="group relative">
          <div className="absolute h-full w-full -rotate-6 rounded-xl border border-slate-200 bg-white opacity-40 backdrop-blur-lg transition-all duration-300 ease-in-out group-hover:-mt-1.5 group-hover:-rotate-[7deg]" />
          <div className="absolute h-full w-full -rotate-3 rounded-xl border border-slate-200 bg-white opacity-70 backdrop-blur-md transition-all duration-200 ease-in-out group-hover:-mt-1 group-hover:-rotate-[4deg]" />
          <div className="flex scale-[0.995] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white bg-opacity-70 p-16 backdrop-blur-lg transition-all duration-200 ease-in-out group-hover:scale-[1]">
            {children}
          </div>
        </div>
      );
    case "straight":
      return (
        <div className="group relative">
          <div className="absolute left-[4%] h-full w-[92%] -translate-y-8 rounded-xl border border-slate-200 bg-white opacity-40 backdrop-blur-lg transition-all duration-300 ease-in-out group-hover:-mt-1.5 group-hover:-translate-y-9" />
          <div className="absolute left-[2%] h-full w-[96%] -translate-y-4 rounded-xl border border-slate-200 bg-white opacity-70 backdrop-blur-md transition-all duration-200 ease-in-out group-hover:-mt-1 group-hover:-translate-y-5" />
          <div className="flex scale-[0.995] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white bg-opacity-70 p-16 backdrop-blur-lg transition-all duration-200 ease-in-out group-hover:scale-[1]">
            {children}
          </div>
        </div>
      );

    default:
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-16 backdrop-blur-lg transition-all duration-200 ease-in-out">
          {children}
        </div>
      );
  }
};
