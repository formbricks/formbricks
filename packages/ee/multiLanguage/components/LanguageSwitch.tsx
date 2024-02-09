"use client";

import { ArrowUpRightIcon, ChevronDownIcon, ChevronUpIcon, LanguageIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import useClickOutside from "@formbricks/lib/useClickOutside";
import { TLanguage } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { Switch } from "@formbricks/ui/Switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";

interface LanguageSwitchProps {
  productLanguages: TLanguage[];
  setSurveyLanguages: (languages: TLanguage[]) => void;
  i18n: boolean;
  setI18n: (i18n: boolean) => void;
  surveyLanguages: TLanguage[];
  environmentId: string;
  isEnterpriseEdition: boolean;
}
export default function LanguageSwitch({
  productLanguages,
  setSurveyLanguages,
  i18n,
  setI18n,
  surveyLanguages,
  environmentId,
  isEnterpriseEdition,
}: LanguageSwitchProps) {
  const [translationsEnabled, setTranslationsEnabled] = useState(i18n);
  const [showLanguageToggle, setshowLanguageToggle] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapperRef, () => {
    setshowLanguageToggle(false);
  });

  const toggleLanguage = (language: TLanguage) => {
    const languageCode = language.id;
    if (surveyLanguages.some((lang) => lang.id === languageCode)) {
      const updateArray = surveyLanguages.filter((lang) => lang.id !== languageCode);
      setSurveyLanguages(updateArray);
    } else {
      const updateArray = [...surveyLanguages, language];
      setSurveyLanguages(updateArray);
    }
  };

  // if there is a change in languages belonging to a particular product, then accordingly update the currently selected languages
  useEffect(() => {
    let updatedLanguagesArray = surveyLanguages.filter((lang) =>
      productLanguages.some((allLang) => allLang.id === lang.id)
    );

    if (updatedLanguagesArray.length !== surveyLanguages.length) {
      setSurveyLanguages(updatedLanguagesArray);
    }
  }, [productLanguages, surveyLanguages]);

  return (
    <div className="flex justify-end">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="z-10 flex w-full items-end justify-end px-7 pt-3">
              {translationsEnabled ? (
                <div>
                  <div
                    className="flex cursor-pointer items-center space-x-2 rounded-lg border bg-white p-2 px-4 hover:bg-slate-50"
                    onClick={() => {
                      if (!isEnterpriseEdition) return;
                      setshowLanguageToggle(!showLanguageToggle);
                    }}>
                    <span className="text-sm">Translation Settings</span>
                    <span>
                      {showLanguageToggle ? (
                        <ChevronUpIcon className="h-4 w-4" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4" />
                      )}
                    </span>
                  </div>
                  {showLanguageToggle && (
                    <div
                      className="absolute z-20 mt-2 space-y-4 rounded-md border bg-white p-4"
                      ref={wrapperRef}>
                      {productLanguages.map((language) => {
                        if (language.default) return;
                        return (
                          <label
                            htmlFor={`switch-${language}`}
                            className="flex cursor-pointer items-center text-sm">
                            <Switch
                              id={`switch-${language}`}
                              value={language.id}
                              className="mr-4"
                              checked={surveyLanguages.some((lang) => lang.id === language.id)}
                              onClick={() => toggleLanguage(language)}
                            />
                            {language.alias}
                          </label>
                        );
                      })}
                      <div className="w-full rounded-md px-5 py-2 hover:bg-slate-50">
                        <Link
                          href={`/environments/${environmentId}/settings/language`}
                          target="_blank"
                          className=" flex w-full items-center gap-x-1.5 text-sm">
                          Add Language <ArrowUpRightIcon className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!isEnterpriseEdition}
                  onClick={() => {
                    setTranslationsEnabled(!translationsEnabled);
                    setI18n(true);
                  }}>
                  Add Translation
                  <LanguageIcon className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </TooltipTrigger>
          {!isEnterpriseEdition && (
            <TooltipContent>
              <p>You need an enterprise lisence to use this feature</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
