import Link from "next/link";
import React from "react";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

interface PathwayOptionProps {
  size: "sm" | "md" | "lg";
  title: string;
  description: string;
  loading?: boolean;
  disabled?: boolean;
  href?: string;
  onSelect?: () => void;
  cssId?: string;
  children?: React.ReactNode;
}

const sizeClasses = {
  sm: "p-4 rounded-lg w-60 shadow-md",
  md: "p-6 rounded-xl w-80  shadow-lg",
  lg: "p-8 rounded-2xl w-100 shadow-xl",
};

const cardContentClasses = "flex h-full w-full flex-col items-center gap-y-4 text-center no-underline";

const interactiveCardClasses =
  "cursor-pointer hover:scale-[1.03] hover:border-slate-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2";

export const OptionCard = ({
  size,
  title,
  description,
  children,
  onSelect,
  href,
  loading,
  disabled = false,
  cssId,
}: Readonly<PathwayOptionProps>) => {
  const isInteractive = !disabled && !loading;
  const baseCardClasses = `flex h-full flex-col items-center border border-slate-200 bg-white transition-transform duration-200 ${sizeClasses[size]}`;

  const cardBody = (
    <div className={cardContentClasses}>
      {children}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-lg font-medium text-slate-800">{title}</p>
        <p className="text-sm text-balance text-slate-500">{description}</p>
      </div>
    </div>
  );

  const renderRoot = () => {
    if (disabled) {
      return (
        <div id={cssId} aria-disabled="true" className={`${baseCardClasses} cursor-not-allowed opacity-50`}>
          {cardBody}
        </div>
      );
    }

    if (href) {
      return (
        <Link
          id={cssId}
          href={href}
          className={`${baseCardClasses} ${interactiveCardClasses} ${loading ? "pointer-events-none" : ""}`}
          aria-busy={loading}>
          {cardBody}
        </Link>
      );
    }

    return (
      <button
        id={cssId}
        type="button"
        disabled={!isInteractive}
        onClick={onSelect}
        className={`${baseCardClasses} ${isInteractive ? interactiveCardClasses : "cursor-not-allowed opacity-50"}`}
        aria-busy={loading}>
        {cardBody}
      </button>
    );
  };

  return (
    <div className="relative h-full w-full">
      {renderRoot()}
      {loading && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-100/70"
          aria-hidden="true">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
};
