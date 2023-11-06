import { LanguageIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
export default function LanguageIndicator({ selectedLanguage, setSelectedLanguage }) {
  const languages = ["default", "german", "hindi"];
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  const toggleDropdown = () => setShowLanguageDropdown((prev) => !prev);

  const changeLanguage = (language) => {
    setSelectedLanguage(language);
    setShowLanguageDropdown(false);
  };
  return (
    <div className="absolute inset-y-2 right-2">
      <button
        type="button"
        className="flex items-center justify-center rounded-lg bg-black p-1 px-2 text-xs text-white"
        onClick={toggleDropdown}
        aria-haspopup="true"
        aria-expanded={showLanguageDropdown}>
        {selectedLanguage}
        <LanguageIcon className="ml-1 h-3 w-3" />
      </button>
      {showLanguageDropdown && (
        <div className="absolute right-0 z-10 mt-1 space-y-2 rounded-lg bg-black p-2 text-xs text-white">
          {languages.map(
            (language) =>
              language !== selectedLanguage && (
                <button
                  key={language}
                  type="button"
                  className="block w-full text-left"
                  onClick={() => changeLanguage(language)}>
                  {language}
                </button>
              )
          )}
        </div>
      )}
    </div>
  );
}
