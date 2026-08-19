import { useRef, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { normalizeLanguageCode } from "@formbricks/i18n-utils/src/canonical";
import { TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TSurveyLanguage } from "@formbricks/types/surveys/types";
import { LanguageIcon } from "@/components/icons/language-icon";
import { mixColor } from "@/lib/color";
import { getI18nLanguage } from "@/lib/i18n-utils";
import i18n from "@/lib/i18n.config";
import { getLanguageDisplayName, getShortLanguageDisplayName } from "@/lib/language-display-name";
import { useClickOutside } from "@/lib/use-click-outside-hook";
import { cn, getSurveyLanguageTag, isRTLLanguage } from "@/lib/utils";

interface LanguageSwitchProps {
  survey: TJsWorkspaceStateSurvey;
  surveyLanguages: TSurveyLanguage[];
  /** The survey's active language: a stored language code, or the `"default"` sentinel. */
  selectedLanguageCode: string;
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
  selectedLanguageCode,
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

  // The active language as a real code: `selectedLanguageCode` may be the "default" sentinel, and
  // may also be a legacy alias ("hi") that was deduped away in favour of its canonical form
  // ("hi-IN"), so it is normalized the same way the option list is before being matched.
  const activeLanguageCode = getSurveyLanguageTag(survey, selectedLanguageCode);
  const activeCanonicalCode = activeLanguageCode
    ? (normalizeLanguageCode(activeLanguageCode) ?? activeLanguageCode)
    : null;
  const isActive = (code: string): boolean =>
    activeCanonicalCode !== null && (normalizeLanguageCode(code) ?? code) === activeCanonicalCode;
  const activeLanguage = visibleLanguages.find((surveyLanguage) => isActive(surveyLanguage.language.code));
  // Endonym ("Deutsch", not "German") — both the a11y convention and better UX for a respondent
  // hunting for their own language. The visible label drops the region, because the full name is
  // long enough to be ellipsised in the chrome row ("Deutsch (Deutschland)", "American English")
  // and the trigger only ever shows one language, so there is nothing to disambiguate against. The
  // accessible name keeps the full name and still contains the visible text (WCAG 2.5.3).
  const activeDisplayName = activeLanguage
    ? getShortLanguageDisplayName(activeLanguage.language.code)
    : undefined;
  // The switcher used to be an unlabelled globe, so neither a sighted nor a screen-reader user
  // could tell which language the survey was in (WCAG 3.1.1).
  const triggerLabel = activeLanguage
    ? t("common.language_switch_current", {
        language: getLanguageDisplayName(activeLanguage.language.code),
      })
    : t("common.language_switch");

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
        title={triggerLabel}
        type="button"
        className={cn(
          "text-heading relative flex h-8 items-center justify-center gap-1.5 rounded-md focus:ring-2 focus:ring-offset-2 focus:outline-hidden",
          activeDisplayName ? "w-auto px-2" : "w-8"
        )}
        style={{
          backgroundColor: isHovered ? hoverColorWithOpacity : "transparent",
          transition: "background-color 0.2s ease",
          borderRadius: typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius,
        }}
        onClick={toggleDropdown}
        aria-haspopup="true"
        aria-expanded={showLanguageDropdown}
        aria-label={triggerLabel}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}>
        <LanguageIcon />
        {activeDisplayName ? (
          // aria-hidden: the button's aria-label already states the language, and leaving this
          // visible to AT would have it announced twice. `lang` still matters for a sighted user
          // whose browser hyphenates or a translation tool that would otherwise mangle the endonym.
          <span aria-hidden="true" lang={activeLanguage?.language.code} className="max-w-24 truncate text-xs">
            {activeDisplayName}
          </span>
        ) : null}
      </button>
      {showLanguageDropdown ? (
        <div
          className={cn(
            "bg-survey-bg text-heading border-border absolute top-10 max-h-64 space-y-2 overflow-auto rounded-md border p-2 text-xs shadow-lg",
            dir === "rtl" ? "left-8" : "right-8"
          )}
          ref={languageDropdownRef}>
          {visibleLanguages.map((surveyLanguage) => {
            const isCurrent = isActive(surveyLanguage.language.code);
            return (
              <button
                key={surveyLanguage.language.id}
                type="button"
                // Marks which option the survey is currently rendered in. `aria-current` rather than
                // `aria-selected`, because these are buttons in a plain popup, not options in a
                // listbox — `aria-selected` on a button role is ignored.
                aria-current={isCurrent ? "true" : undefined}
                // Each label is written in its own language, so without this a screen reader reads
                // "Deutsch" and "日本語" with the page language's pronunciation rules.
                lang={surveyLanguage.language.code}
                className={cn(
                  "hover:bg-brand hover:text-on-brand block w-full max-w-48 truncate rounded-md p-1.5 text-left",
                  isCurrent && "font-semibold"
                )}
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
