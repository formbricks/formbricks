import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useClickOutside } from "@formbricks/lib/utils/hooks/useClickOutside";
import { TLanguage } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";

import { TIso639Language, iso639Languages } from "../lib/isoLanguages";

interface LanguageSelectProps {
  language: TLanguage;
  onLanguageChange: (newLanguage: TLanguage) => void;
  disabled: boolean;
}

export const LanguageSelect = ({ language, onLanguageChange, disabled }: LanguageSelectProps) => {
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

  useClickOutside(languageSelectRef, () => setIsOpen(false));

  const handleOptionSelect = (option: TIso639Language) => {
    setSelectedOption(option);
    onLanguageChange({ ...language, code: option?.alpha2 || "" });
    setIsOpen(false);
  };

  const filteredItems = items.filter((item) => item.english.toLowerCase().includes(searchTerm.toLowerCase()));

  // Focus the input when the dropdown is opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <div className="group relative h-full" ref={languageSelectRef}>
      <Button
        disabled={disabled}
        variant="minimal"
        onClick={toggleDropdown}
        className="flex h-full w-full justify-between border border-slate-200 px-3 py-2">
        <span className="mr-2">{selectedOption?.english ?? "Select"}</span>
        <ChevronDown className="h-4 w-4" />
      </Button>
      <div
        className={`absolute right-0 z-30 mt-2 space-y-1 rounded-md bg-white p-1 shadow-lg ring-1 ring-black ring-opacity-5 ${isOpen ? "" : "hidden"}`}>
        <Input
          type="text"
          placeholder="Search items"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoComplete="off"
          ref={inputRef}
        />
        <div className="max-h-96 overflow-auto">
          {filteredItems.map((item, index) => (
            <div
              key={index}
              onClick={() => handleOptionSelect(item)}
              className="block cursor-pointer rounded-md px-4 py-2 text-gray-700 hover:bg-gray-100 active:bg-blue-100">
              {item.english}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
