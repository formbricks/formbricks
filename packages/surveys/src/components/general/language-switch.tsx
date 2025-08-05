import { LanguageIcon } from "@/components/icons/language-icon";
import { mixColor } from "@/lib/color";
import { useClickOutside } from "@/lib/use-click-outside-hook";
import { cn } from "@/lib/utils";
import { useRef, useState } from "preact/hooks";
import { getLanguageLabel } from "@formbricks/i18n-utils/src";
import { type TSurveyLanguage } from "@formbricks/types/surveys/types";

interface LanguageSwitchProps {
  surveyLanguages: TSurveyLanguage[];
  setSelectedLanguageCode: (languageCode: string) => void;
  setFirstRender?: (firstRender: boolean) => void;
  hoverColor?: string;
  borderRadius?: number;
}
export function LanguageSwitch({
  surveyLanguages,
  setSelectedLanguageCode,
  setFirstRender,
  hoverColor,
  borderRadius,
}: LanguageSwitchProps) {
  const hoverColorWithOpacity = hoverColor ?? mixColor("#000000", "#ffffff", 0.8);

  const [isHovered, setIsHovered] = useState(false);

  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const toggleDropdown = () => {
    setShowLanguageDropdown((prev) => !prev);
  };
  const languageDropdownRef = useRef(null);
  const defaultLanguageCode = surveyLanguages.find((surveyLanguage) => {
    return surveyLanguage.default;
  })?.language.code;

  const changeLanguage = (languageCode: string) => {
    if (languageCode === defaultLanguageCode) {
      setSelectedLanguageCode("default");
    } else {
      setSelectedLanguageCode(languageCode);
    }
    if (setFirstRender) {
      //for lexical editor
      setFirstRender(true);
    }
    setShowLanguageDropdown(false);
  };

  useClickOutside(languageDropdownRef, () => {
    setShowLanguageDropdown(false);
  });

  return (
    <div className="fb-z-[1001] fb-flex fb-w-fit fb-items-center">
      <button
        title="Language switch"
        type="button"
        className={cn(
          "fb-text-heading fb-relative fb-h-8 fb-w-8 fb-rounded-md focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2 fb-justify-center fb-flex fb-items-center"
        )}
        style={{
          backgroundColor: isHovered ? hoverColorWithOpacity : "transparent",
          transition: "background-color 0.2s ease",
          borderRadius: `${borderRadius}px`,
        }}
        onClick={toggleDropdown}
        tabIndex={-1}
        aria-haspopup="true"
        aria-expanded={showLanguageDropdown}
        aria-label="Language switch"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}>
        <LanguageIcon />
      </button>
      {showLanguageDropdown ? (
        <div
          className="fb-bg-brand fb-text-on-brand fb-absolute fb-right-8 fb-top-10 fb-space-y-2 fb-rounded-md fb-p-2 fb-text-xs"
          ref={languageDropdownRef}>
          {surveyLanguages.map((surveyLanguage) => {
            if (!surveyLanguage.enabled) return;
            return (
              <button
                key={surveyLanguage.language.id}
                type="button"
                className="fb-block fb-w-full fb-p-1.5 fb-text-left hover:fb-opacity-80"
                onClick={() => {
                  changeLanguage(surveyLanguage.language.code);
                }}>
                {getLanguageLabel(surveyLanguage.language.code, "en-US")}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
