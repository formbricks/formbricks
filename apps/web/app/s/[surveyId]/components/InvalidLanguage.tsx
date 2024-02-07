import { ArrowUpRightIcon } from "@heroicons/react/24/outline";

import { TLanguage } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { StackedCardsContainer } from "@formbricks/ui/StackedCardsContainer";

interface InvalidLanguageProps {
  languages: TLanguage[];
  surveyUrl: string;
}

export default function InvalidLanguage({ languages, surveyUrl }: InvalidLanguageProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-center">
      <StackedCardsContainer>
        <span className="h-24 w-24 rounded-full bg-slate-200 p-6 text-5xl">🈂️</span>
        <p className="mt-8 text-4xl font-bold">Survey not available in specified language</p>
        <p className="mt-4 text-slate-500">Please try in one of the following languages:</p>
        <div className="mt-8 flex space-x-2">
          {languages.map((language) => (
            <Button
              variant="secondary"
              href={surveyUrl + `?lang=${language.id}`}
              endIconClassName="h-4 w-4"
              EndIcon={ArrowUpRightIcon}>
              <span>{language.alias}</span>
            </Button>
          ))}
        </div>
      </StackedCardsContainer>
    </div>
  );
}
