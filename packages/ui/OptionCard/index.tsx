import React from "react";
import { LoadingSpinner } from "../LoadingSpinner";

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
  sm: "rounded-lg border border-slate-200 shadow-card-sm transition-all duration-150",
  md: "rounded-xl border border-slate-200 shadow-card-md transition-all duration-300",
  lg: "rounded-2xl border border-slate-200 shadow-card-lg transition-all duration-500",
};

export const OptionCard: React.FC<PathwayOptionProps> = ({
  size,
  title,
  description,
  children,
  onSelect,
  loading,
  cssId,
}) => (
  <div className="relative h-full">
    <div
      id={cssId}
      className={`flex h-full cursor-pointer flex-col items-center justify-center bg-white p-6 hover:scale-105 hover:border-slate-300 ${sizeClasses[size]}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}>
      <div className="space-y-4">
        {children}
        <div className="space-y-2">
          <p className="text-xl font-medium text-slate-800">{title}</p>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
    </div>
    {loading && (
      <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-slate-100 opacity-50">
        <LoadingSpinner />
      </div>
    )}
  </div>
);
