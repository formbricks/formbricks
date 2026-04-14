import { Search } from "lucide-react";
import * as React from "react";

/** Number of options above which the search input is shown inside the dropdown */
export const SEARCH_THRESHOLD = 3;

interface UseDropdownSearchOptions<T extends { id: string; label: string }> {
  options: T[];
  hasOtherOption: boolean;
  otherOptionLabel: string;
  isSearchEnabled: boolean;
}

/**
 * Shared hook that encapsulates search filtering, "none"-option separation,
 * and side-locking logic used by both single-select and multi-select dropdowns.
 */
export function useDropdownSearch<T extends { id: string; label: string }>({
  options,
  hasOtherOption,
  otherOptionLabel,
  isSearchEnabled,
}: UseDropdownSearchOptions<T>) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Lock the dropdown side (top/bottom) so it doesn't jump when search filters shrink the content
  const [lockedSide, setLockedSide] = React.useState<"top" | "bottom" | undefined>(undefined);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Separate "none" option from regular options so it renders at the bottom of the list
  const noneOption = React.useMemo(() => options.find((opt) => opt.id === "none"), [options]);
  const regularOptions = React.useMemo(() => options.filter((opt) => opt.id !== "none"), [options]);

  // Filtered regular options based on the search query
  const filteredRegularOptions = React.useMemo(() => {
    if (!isSearchEnabled || !searchQuery) return regularOptions;
    const lowerQuery = searchQuery.toLowerCase();
    return regularOptions.filter((opt) => opt.label.toLowerCase().includes(lowerQuery));
  }, [isSearchEnabled, searchQuery, regularOptions]);

  // Whether the "other" option matches the search
  const otherMatchesSearch = React.useMemo(() => {
    if (!hasOtherOption) return false;
    if (!isSearchEnabled || !searchQuery) return true;
    return otherOptionLabel.toLowerCase().includes(searchQuery.toLowerCase());
  }, [isSearchEnabled, searchQuery, hasOtherOption, otherOptionLabel]);

  // Whether the "none" option matches the search
  const noneMatchesSearch = React.useMemo(() => {
    if (!noneOption) return false;
    if (!isSearchEnabled || !searchQuery) return true;
    return noneOption.label.toLowerCase().includes(searchQuery.toLowerCase());
  }, [isSearchEnabled, searchQuery, noneOption]);

  const hasNoResults =
    isSearchEnabled && filteredRegularOptions.length === 0 && !otherMatchesSearch && !noneMatchesSearch;

  const focusSearchAndLockSide = (): void => {
    searchInputRef.current?.focus();
    const side = contentRef.current?.dataset.side;
    if (side === "top" || side === "bottom") setLockedSide(side);
  };

  const handleDropdownOpen = (): void => {
    if (isSearchEnabled) {
      // Double-defer to win against Radix focus management
      globalThis.setTimeout(() => {
        globalThis.requestAnimationFrame(focusSearchAndLockSide);
      }, 0);
    }
  };

  const handleDropdownClose = (): void => {
    setSearchQuery("");
    setLockedSide(undefined);
  };

  return {
    searchQuery,
    setSearchQuery,
    searchInputRef,
    lockedSide,
    contentRef,
    noneOption,
    noneMatchesSearch,
    filteredRegularOptions,
    otherMatchesSearch,
    hasNoResults,
    handleDropdownOpen,
    handleDropdownClose,
  };
}

interface DropdownSearchInputProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  placeholder: string;
  dir?: string;
}

/**
 * Search input rendered at the top of a searchable dropdown.
 */
export function DropdownSearchInput({
  searchQuery,
  setSearchQuery,
  searchInputRef,
  placeholder,
  dir,
}: Readonly<DropdownSearchInputProps>): React.JSX.Element {
  return (
    <div className="border-option-border border-b pb-0.5" role="search">
      <div className="relative flex items-center">
        <Search className="text-input-text pointer-events-none absolute left-1.5 h-4 w-4 shrink-0" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
          }}
          placeholder={placeholder}
          dir={dir}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (searchQuery) {
                e.stopPropagation();
                setSearchQuery("");
              }
            } else if (e.key !== "ArrowDown" && e.key !== "ArrowUp") {
              e.stopPropagation();
            }
          }}
          className="bg-input-bg text-input-text placeholder:text-input-placeholder font-input font-input-weight h-9 w-full rounded-sm pr-3 pl-8 text-sm outline-none"
          aria-label={placeholder}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
