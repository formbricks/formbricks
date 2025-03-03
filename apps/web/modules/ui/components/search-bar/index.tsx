import { Search } from "lucide-react";
import React from "react";
import { cn } from "@formbricks/lib/cn";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = "Search by survey name",
  className,
}) => {
  return (
    <div
      className={cn(
        "flex h-8 items-center rounded-lg border border-slate-300 bg-white px-4 text-slate-800",
        className
      )}>
      <Search className="h-4 w-4" />
      <input
        type="text"
        className="w-full border-none bg-transparent text-sm focus:outline-none"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};
