"use client";

import { Language } from "@prisma/client";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TIso639Language, iso639Languages } from "@formbricks/i18n-utils/src/utils";
import { TUserLocale } from "@formbricks/types/user";
import { useClickOutside } from "@/lib/utils/hooks/useClickOutside";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";

interface LanguageSelectProps {
  language: Language;
  onLanguageChange: (newLanguage: Language) => void;
  disabled: boolean;
  locale: TUserLocale;
}

export function LanguageSelect({ language, onLanguageChange, disabled, locale }: LanguageSelectProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOption, setSelectedOption] = useState(
    iso639Languages.find((isoLang) => isoLang.alpha2 === language.code)
  );
  const items = iso639Languages;

  const languageSelectRef = useRef(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  useClickOutside(languageSelectRef, () => {
    setIsOpen(false);
  });

  const handleOptionSelect = (option: TIso639Language) => {
    setSelectedOption(option);
    onLanguageChange({ ...language, code: option.alpha2 || "" });
    setIsOpen(false);
  };

  // Most ISO entries don't ship with every locale translation, so fall back to
  // English to keep the dropdown readable for locales such as Dutch that were
  // added recently.
  const getLabelForLocale = (item: TIso639Language) => item.label[locale] ?? item.label["en-US"];

  const filteredItems = items.filter((item) =>
    getLabelForLocale(item).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Focus the input when the dropdown is opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <div className="group relative h-full" ref={languageSelectRef}>
      <Button
        className="flex h-full w-full justify-between border border-slate-200 px-3 py-2"
        disabled={disabled}
        onClick={toggleDropdown}
        variant="ghost">
        <span className="mr-2 min-w-0 truncate">
          {selectedOption ? getLabelForLocale(selectedOption) : t("common.select")}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </Button>
      <div
        className={`absolute right-0 z-30 mt-2 space-y-1 rounded-md bg-white p-1 shadow-lg ring-1 ring-black ring-opacity-5 ${isOpen ? "" : "hidden"}`}>
        <Input
          autoComplete="off"
          onChange={(e) => {
            setSearchTerm(e.target.value);
          }}
          placeholder={t("environments.project.languages.search_items")}
          ref={inputRef}
          type="text"
          value={searchTerm}
        />
        <div className="max-h-96 overflow-auto">
          {filteredItems.map((item) => (
            <button
              className="block w-full cursor-pointer rounded-md px-4 py-2 text-left text-slate-700 hover:bg-slate-100 active:bg-blue-100"
              key={item.alpha2}
              onClick={() => {
                handleOptionSelect(item);
              }}>
              {getLabelForLocale(item)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
