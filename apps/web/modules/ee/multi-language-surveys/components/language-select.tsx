import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { TIso639Language } from "@formbricks/lib/i18n/utils";
import { iso639Languages } from "@formbricks/lib/i18n/utils";
import { useClickOutside } from "@formbricks/lib/utils/hooks/useClickOutside";
import type { TLanguage } from "@formbricks/types/project";
import { TUserLocale } from "@formbricks/types/user";

interface LanguageSelectProps {
  language: TLanguage;
  onLanguageChange: (newLanguage: TLanguage) => void;
  disabled: boolean;
  locale: TUserLocale;
}

export function LanguageSelect({ language, onLanguageChange, disabled, locale }: LanguageSelectProps) {
  const t = useTranslations();
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

  const filteredItems = items.filter((item) =>
    item.label[locale].toLowerCase().includes(searchTerm.toLowerCase())
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
        variant="minimal">
        <span className="mr-2">{selectedOption?.label[locale] ?? t("common.select")}</span>
        <ChevronDown className="h-4 w-4" />
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
          {filteredItems.map((item, index) => (
            <div
              className="block cursor-pointer rounded-md px-4 py-2 text-slate-700 hover:bg-slate-100 active:bg-blue-100"
              key={index}
              onClick={() => {
                handleOptionSelect(item);
              }}>
              {item.label[locale]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
