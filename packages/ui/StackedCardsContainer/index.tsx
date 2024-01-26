"use client";

interface StackedCardsContainerProps {
  children: React.ReactNode;
}

export const StackedCardsContainer: React.FC<StackedCardsContainerProps> = ({ children }) => {
  return (
    <div className="relative">
      <div className="absolute -left-2 h-[93%] w-[98%] -rotate-6 rounded-xl border border-slate-200 bg-white opacity-40 backdrop-blur-lg" />
      <div className="absolute -left-1 h-[93%] w-[98%] -rotate-3 rounded-xl border border-slate-200 bg-white opacity-70 backdrop-blur-md" />
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white bg-opacity-70 p-16 backdrop-blur-lg">
        {children}
      </div>
    </div>
  );
};
