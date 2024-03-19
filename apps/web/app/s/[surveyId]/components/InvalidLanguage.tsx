import { StackedCardsContainer } from "@formbricks/ui/StackedCardsContainer";

export default function InvalidLanguage() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-center">
      <StackedCardsContainer>
        <span className="h-24 w-24 rounded-full bg-slate-200 p-6 text-5xl">🈂️</span>
        <p className="mt-8 text-4xl font-bold">Survey not available in specified language</p>
      </StackedCardsContainer>
    </div>
  );
}
