import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import React from "react";

interface PathwayOptionProps {
  size: "sm" | "md" | "lg";
  title: string;
  description: string;
  loading?: boolean;
  onSelect?: () => void;
  cssId?: string;
  children?: React.ReactNode;
}

const sizeClasses = {
  sm: "p-4 rounded-lg w-60 shadow-md",
  md: "p-6 rounded-xl w-80  shadow-lg",
  lg: "p-8 rounded-2xl w-100 shadow-xl",
};

export const OptionCard: React.FC<PathwayOptionProps> = ({
  size,
  title,
  description,
  children,
  onSelect,
  loading,
  cssId,
}) => {
  return (
    <div className="relative h-full">
      <div
        id={cssId}
        className={`flex cursor-pointer flex-col items-center justify-center border border-slate-200 bg-white transition-transform duration-200 hover:scale-[1.03] hover:border-slate-300 ${sizeClasses[size]}`}
        onClick={onSelect}
        role="button"
        tabIndex={0}>
        <div className="flex flex-col items-center space-y-4">
          {children}
          <div className="text-center">
            <p className="text-lg font-medium text-slate-800">{title}</p>
            <p className="text-sm text-slate-500">{description}</p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/70">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
};
