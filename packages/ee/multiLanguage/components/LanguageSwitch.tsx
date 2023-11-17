"use client";

import { Button } from "@formbricks/ui/Button";
import { LanguageIcon, ChevronDownIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { Switch } from "@formbricks/ui/Switch";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";
import { convertArrayToObject } from "../utils/i18n";
import { TLanguages } from "@formbricks/types/product";

interface LanguageSwitchProps {
  allLanguages: string[][];
  setLanguages: any;
  setI18n: (i18n: boolean) => void;
  languages: TLanguages;
  environmentId: string;
  isEnterpriseEdition: boolean;
}
export default function LanguageSwitch({
  allLanguages,
  setLanguages,
  setI18n,
  languages,
  environmentId,
  isEnterpriseEdition,
}: LanguageSwitchProps) {
  const [translationsEnabled, setTranslationsEnabled] = useState(false);
  const [showLanguageToggle, setshowLanguageToggle] = useState(false);
  const [languagesArray, setLanguagesArray] = useState<string[][]>(Object.entries(languages));

  const toggleLanguage = (language: string[]) => {
    const languageCode = language[0]; // Assuming the first element is a unique language code
    if (languagesArray.some((lang) => lang[0] === languageCode)) {
      const updateArray = languagesArray.filter((lang) => lang[0] !== languageCode);
      setLanguagesArray(updateArray);
      setLanguages(convertArrayToObject(updateArray));
    } else {
      const updateArray = [...languagesArray, language];
      setLanguagesArray(updateArray);
      setLanguages(convertArrayToObject(updateArray));
    }
  };

  return (
    <div className="flex justify-end">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="z-10 flex h-14 w-full items-end justify-end px-6">
              {translationsEnabled ? (
                <div>
                  <div
                    className="flex cursor-pointer items-center space-x-2 rounded-lg border bg-white p-2 px-4"
                    onClick={() => {
                      if (!isEnterpriseEdition) return;
                      setshowLanguageToggle(!showLanguageToggle);
                    }}>
                    <span>Select Language</span>
                    <span>
                      <ChevronDownIcon className="h-4 w-4" />
                    </span>
                  </div>
                  {showLanguageToggle && (
                    <div className="absolute z-20 mt-2 space-y-4 rounded-md border bg-white p-4">
                      {allLanguages?.map((language) => {
                        if (language[0] === "en") return;
                        return (
                          <div className="flex items-center">
                            <Switch
                              id={`switch-${language}`}
                              value={language}
                              className="mr-4"
                              checked={languagesArray.some((lang) => lang[0] === language[0])}
                              onClick={() => toggleLanguage(language)}
                            />
                            {language[1]}
                          </div>
                        );
                      })}
                      <div className="w-full">
                        <Link
                          href={`/environments/${environmentId}/settings/language`}
                          className=" w-full text-sm">
                          Add Language +
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  variant="secondary"
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
