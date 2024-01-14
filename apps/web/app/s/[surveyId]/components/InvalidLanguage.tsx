import { ArrowUpRightIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import React from "react";

interface InvalidLanguageProps {
  languages: string[][];
  surveyUrl: string;
}

export default function InvalidLanguage({ languages, surveyUrl }: InvalidLanguageProps) {
  return (
    <div className="flex h-[100vh] w-[100vw] flex-col items-center justify-center bg-slate-50">
      <span className="h-24 w-24 rounded-full bg-slate-300 p-6 text-5xl">🈂️</span>
      <p className="mt-8 text-4xl font-bold">Survey not available in specified language</p>
      <p className="mt-4 cursor-pointer text-sm text-slate-400">
        Please try in one of the following langauges
      </p>
      <div className="mt-6 flex space-x-2">
        {languages.map((language) => (
          <Link href={surveyUrl + `?lang=${language[0]}`}>
            <div className="flex items-center rounded-lg bg-slate-300 p-4 text-black hover:cursor-pointer hover:bg-slate-400">
              <span>{language[1]}</span>
              <ArrowUpRightIcon className="ml-4 h-4 w-4 text-black" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
