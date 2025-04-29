"use client";

import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { useTranslate } from "@tolgee/react";
import { Search as SearchIcon, X as XIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface SearchSectionProps {
  setSearchQuery: (query: string) => void;
}

export function SearchSection({ setSearchQuery }: SearchSectionProps) {
  const { t } = useTranslate();
  const [query, setQuery] = useState<string>("");

  const handleClear = () => {
    setQuery("");
    setSearchQuery("");
  };

  useEffect(() => {
    if (query == "") {
      setSearchQuery("");
    }
  }, [query, setSearchQuery]);

  return (
    <div className={"flex w-full items-center gap-2"}>
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3">
          <SearchIcon className="h-4 w-4 text-slate-400" />
        </div>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSearchQuery(query);
            }
          }}
          placeholder={t("environments.activity.search.search_by_engagement_name_or_description")}
          className="w-full border-slate-300 px-10 focus:border-slate-400"
        />

        {query && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <button
              onClick={() => handleClear()}
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <Button
        onClick={() => setSearchQuery(query)}
        className="border-slate-800 bg-slate-800 text-white hover:border-slate-700 hover:bg-slate-700">
        {t("common.search")}
      </Button>
    </div>
  );
}

export default SearchSection;
