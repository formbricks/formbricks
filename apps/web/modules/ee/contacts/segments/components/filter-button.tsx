import React from "react";

function FilterButton({
  icon,
  label,
  onClick,
  onKeyDown,
  tabIndex = 0,
  className = "",
  ...props
}: {
  readonly icon: React.ReactNode;
  readonly label: React.ReactNode;
  readonly onClick: () => void;
  readonly onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  readonly tabIndex?: number;
  readonly className?: string;
  [key: string]: any;
}) {
  return (
    <button
      type="button"
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
