"use client";

interface StackedCardsContainerProps {
  children: React.ReactNode;
}

export const StackedCardsContainer: React.FC<StackedCardsContainerProps> = ({ children }) => {
  return (
    <div className="group relative">
      <div className="absolute -left-2 h-[89%] w-[98%] -rotate-6 rounded-xl border border-slate-200 bg-white opacity-40 backdrop-blur-lg transition-all duration-300 ease-in-out group-hover:-mt-1.5 group-hover:-rotate-[7deg]" />
      <div className="absolute h-[93%] w-[98%] -rotate-3 rounded-xl border border-slate-200 bg-white opacity-70 backdrop-blur-md transition-all duration-200 ease-in-out group-hover:-mt-1 group-hover:-rotate-[4deg]" />
      <div className="flex scale-[0.995] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white bg-opacity-70 p-16 backdrop-blur-lg transition-all duration-200 ease-in-out group-hover:scale-[1]">
        {children}
      </div>
    </div>
  );
};
