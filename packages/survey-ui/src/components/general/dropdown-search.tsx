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
    const dataset = contentRef.current?.dataset;
    if (!dataset) return;
    const side = dataset.side;
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

  const getMenuItems = (): HTMLElement[] => {
    // Resolve the menu from the search input itself: contentRef is not reliably
    // attached under preact/compat (ref-as-prop forwarding), but the input always
    // lives inside the open menu content.
    const menu = searchInputRef.current?.closest("[role='menu']") ?? contentRef.current;
    return menu
      ? [
          ...menu.querySelectorAll<HTMLElement>(
            "[role='menuitemradio']:not([data-disabled]),[role='menuitemcheckbox']:not([data-disabled]),[role='menuitem']:not([data-disabled])"
          ),
        ]
      : [];
  };

  // Radix's menu keyboard handling ignores keydowns that originate from the
  // search input, so arrow keys must move focus into the option list manually.
  const focusMenuItem = (which: "first" | "last"): void => {
    const items = getMenuItems();
    if (items.length === 0) return;
    const target = which === "first" ? items[0] : items[items.length - 1];
    target.focus();
  };

  // While focus is on the options, typing edits the search query instead of
  // triggering the Radix menu typeahead; ArrowUp on the first option returns
  // to the search input. Space/Enter keep their native select behavior.
  const handleContentKeyDown = (e: React.KeyboardEvent): void => {
    if (!isSearchEnabled) return;
    const target = e.target as HTMLElement;
    if (target === searchInputRef.current) return;

    const isPrintable = e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (isPrintable || e.key === "Backspace") {
      e.preventDefault();
      e.stopPropagation();
      setSearchQuery(isPrintable ? searchQuery + e.key : searchQuery.slice(0, -1));
      searchInputRef.current?.focus();
      return;
    }

    if (e.key === "ArrowUp" && target === getMenuItems()[0]) {
      e.preventDefault();
      e.stopPropagation();
      searchInputRef.current?.focus();
    }
  };

  return {
    focusMenuItem,
    handleContentKeyDown,
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
  /** Moves focus into the option list (ArrowDown → first, ArrowUp → last) */
  onNavigateToOptions: (which: "first" | "last") => void;
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
  onNavigateToOptions,
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
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              e.stopPropagation();
              onNavigateToOptions(e.key === "ArrowDown" ? "first" : "last");
            } else {
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
