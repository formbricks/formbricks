import { useRef, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/src";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { type TSurveyLanguage } from "@formbricks/types/surveys/types";
import { LanguageIcon } from "@/components/icons/language-icon";
import { mixColor } from "@/lib/color";
import { getI18nLanguage } from "@/lib/i18n-utils";
import i18n from "@/lib/i18n.config";
import { useClickOutside } from "@/lib/use-click-outside-hook";
import { checkIfSurveyIsRTL, cn } from "@/lib/utils";

interface LanguageSwitchProps {
  survey: TJsEnvironmentStateSurvey;
  surveyLanguages: TSurveyLanguage[];
  setSelectedLanguageCode: (languageCode: string) => void;
  setFirstRender?: (firstRender: boolean) => void;
  hoverColor?: string;
  borderRadius?: number;
  dir?: "ltr" | "rtl" | "auto";
  setDir?: (dir: "ltr" | "rtl" | "auto") => void;
}

export function LanguageSwitch({
  survey,
  surveyLanguages,
  setSelectedLanguageCode,
  setFirstRender,
  hoverColor,
  borderRadius,
  dir = "auto",
  setDir,
}: LanguageSwitchProps) {
  const { t } = useTranslation();
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

  const handleI18nLanguage = (languageCode: string) => {
    const calculatedLanguage = getI18nLanguage(languageCode, surveyLanguages);
    if (i18n.language !== calculatedLanguage) {
      i18n.changeLanguage(calculatedLanguage);
    }
  };

  const changeLanguage = (languageCode: string) => {
    const calculatedLanguageCode = languageCode === defaultLanguageCode ? "default" : languageCode;
    setSelectedLanguageCode(calculatedLanguageCode);

    handleI18nLanguage(calculatedLanguageCode);

    if (setDir) {
      const calculateDir = checkIfSurveyIsRTL(survey, calculatedLanguageCode) ? "rtl" : "auto";
      setDir?.(calculateDir);
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
    <div className="z-1001 flex w-fit items-center">
      <button
        title={t("common.language_switch")}
        type="button"
        className={cn(
          "text-heading relative flex h-8 w-8 items-center justify-center rounded-md focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
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
        aria-label={t("common.language_switch")}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}>
        <LanguageIcon />
      </button>
      {showLanguageDropdown ? (
        <div
          className={cn(
            "bg-input-bg text-heading border-border absolute top-10 max-h-64 space-y-2 overflow-auto rounded-md border p-2 text-xs",
            dir === "rtl" ? "left-8" : "right-8"
          )}
          ref={languageDropdownRef}>
          {surveyLanguages.map((surveyLanguage) => {
            if (!surveyLanguage.enabled) return;
            return (
              <button
                key={surveyLanguage.language.id}
                type="button"
                className="hover:bg-brand hover:text-on-brand block w-full max-w-48 truncate rounded-md p-1.5 text-left"
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
