import { LanguageIcon } from "@heroicons/react/24/solid";
import { useState } from "react";

interface LanguageIndicatorProps {
  selectedLanguage: string;
  languages: string[][];
  setSelectedLanguage: (language: string) => void;
}
export function LanguageIndicator({
  selectedLanguage,
  languages,
  setSelectedLanguage,
}: LanguageIndicatorProps) {
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  const toggleDropdown = () => setShowLanguageDropdown((prev) => !prev);

  const changeLanguage = (language: string[]) => {
    setSelectedLanguage(language[0]);
    setShowLanguageDropdown(false);
  };
  return (
    <div className="absolute right-2 top-2 z-50">
      <button
        type="button"
        className="flex items-center justify-center rounded-lg bg-black p-1 px-2 text-xs text-white"
        onClick={toggleDropdown}
        aria-haspopup="true"
        aria-expanded={showLanguageDropdown}>
        {languages.find((language) => language[0] === selectedLanguage)![1]}
        <LanguageIcon className="ml-1 h-3 w-3" />
      </button>
      {showLanguageDropdown && (
        <div className="absolute right-0 mt-1 space-y-2 rounded-lg bg-black p-2 text-xs text-white">
          {languages.map(
            (language) =>
              language[0] !== selectedLanguage && (
                <button
                  key={language[0]}
                  type="button"
                  className="m-0 block w-full text-left"
                  onClick={() => changeLanguage(language)}>
                  {language[1]}
                </button>
              )
          )}
        </div>
      )}
    </div>
  );
}
