import { useRef, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { normalizeLanguageCode } from "@formbricks/i18n-utils/src/canonical";
import { TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TSurveyLanguage } from "@formbricks/types/surveys/types";
import { LanguageIcon } from "@/components/icons/language-icon";
import { mixColor } from "@/lib/color";
import { getI18nLanguage } from "@/lib/i18n-utils";
import i18n from "@/lib/i18n.config";
import { getLanguageDisplayName } from "@/lib/language-display-name";
import { useClickOutside } from "@/lib/use-click-outside-hook";
import { cn, isRTLLanguage } from "@/lib/utils";

interface LanguageSwitchProps {
  survey: TJsWorkspaceStateSurvey;
  surveyLanguages: TSurveyLanguage[];
  setSelectedLanguageCode: (languageCode: string) => void;
  setFirstRender?: (firstRender: boolean) => void;
  hoverColor?: string;
  borderRadius?: number | string;
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

  // Dedupe enabled languages by canonical code so the back-compat legacy aliases (e.g. "hi" sent
  // alongside "hi-IN") don't show as duplicate options. Prefer the canonical entry over a legacy alias
  // regardless of order (an entry is canonical when its code equals its normalized form), so the
  // dropdown always keeps the canonical code in state and label.
  const languagesByCanonical = new Map<string, TSurveyLanguage>();
  for (const surveyLanguage of surveyLanguages) {
    if (!surveyLanguage.enabled) continue;
    const code = surveyLanguage.language.code;
    const canonical = normalizeLanguageCode(code) ?? code;
    const existing = languagesByCanonical.get(canonical);
    if (!existing || code === canonical) {
      languagesByCanonical.set(canonical, surveyLanguage);
    }
  }
  const visibleLanguages = [...languagesByCanonical.values()];

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
      const calculateDir = isRTLLanguage(survey, calculatedLanguageCode) ? "rtl" : "ltr";
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
          borderRadius: typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius,
        }}
        onClick={toggleDropdown}
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
            "bg-survey-bg text-heading border-border absolute top-10 max-h-64 space-y-2 overflow-auto rounded-md border p-2 text-xs shadow-lg",
            dir === "rtl" ? "left-8" : "right-8"
          )}
          ref={languageDropdownRef}>
          {visibleLanguages.map((surveyLanguage) => {
            return (
              <button
                key={surveyLanguage.language.id}
                type="button"
                className="hover:bg-brand hover:text-on-brand block w-full max-w-48 truncate rounded-md p-1.5 text-left"
                onClick={() => {
                  changeLanguage(surveyLanguage.language.code);
                }}>
                {getLanguageDisplayName(surveyLanguage.language.code)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
