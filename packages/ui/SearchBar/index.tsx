import { Search } from "lucide-react";
import React from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = "Search by survey name",
}) => {
  return (
    <div className="flex h-8 items-center rounded-lg border border-slate-300 bg-white px-4">
      <Search className="h-4 w-4" />
      <input
        type="text"
        className="ml-2 w-full border-none bg-transparent placeholder:text-sm focus:outline-none"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};
