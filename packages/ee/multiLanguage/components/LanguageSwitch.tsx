"use client";

import { ChevronDownIcon } from "@heroicons/react/24/solid";

import { TSurveyLanguage } from "@formbricks/types/surveys";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";

import { getLanguageLabel } from "../lib/isoLanguages";

interface LanguageSwitchProps {
  surveyLanguages: TSurveyLanguage[];
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
}
export default function LanguageSwitch({
  surveyLanguages,
  selectedLanguageCode,
  setSelectedLanguageCode,
}: LanguageSwitchProps) {
  if (selectedLanguageCode === "default") {
    selectedLanguageCode =
      surveyLanguages.find((surveyLanguage) => {
        return surveyLanguage.default === true;
      })?.language.code ?? "default";
  }
  return (
    <div className="mx-8 flex h-10 justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          asChild
          className="surveyFilterDropdown h-full cursor-pointer border border-slate-700 outline-none hover:bg-slate-900">
          <div className="min-w-auto h-8 rounded-md border sm:flex sm:px-2">
            <div className="hidden w-full items-center justify-between px-2 hover:text-white sm:flex">
              <span className="text-sm">Select Language</span>
              <ChevronDownIcon className="ml-2 h-4 w-4" />
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-black p-2">
          {surveyLanguages.length > 0 ? (
            surveyLanguages.map((surveyLanguage) => (
              <DropdownMenuItem
                key={surveyLanguage.language.id}
                className="m-0 p-0"
                onClick={() => {
                  setSelectedLanguageCode(surveyLanguage.language.code);
                }}>
                <div className="flex h-full w-full items-center space-x-2 px-2 py-1 hover:bg-slate-700">
                  <span
                    className={`h-4 w-4 rounded-full border ${surveyLanguage.language.code === selectedLanguageCode ? "bg-brand-dark outline-brand-dark border-black outline" : "border-white"}`}></span>
                  <p className="font-normal text-white">{getLanguageLabel(surveyLanguage.language.code)}</p>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <p className="p-2 text-sm font-normal text-white">No languages to select</p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
