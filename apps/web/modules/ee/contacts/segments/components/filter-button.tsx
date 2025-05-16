import React from "react";

function FilterButton({
  // NOSONAR // read-only is not used in the project
  icon,
  label,
  onClick,
  onKeyDown,
  tabIndex = 0,
  className = "",
  ...props
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  onClick: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  tabIndex?: number;
  className?: string;
  [key: string]: any;
}) {
  return (
    <button
      className={`flex w-full cursor-pointer items-center gap-4 rounded-lg px-2 py-1 text-sm hover:bg-slate-50 ${className}`}
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={onKeyDown}
      {...props}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default FilterButton;
