import clsx from "clsx";
import { useMemo } from "react";
import { EngineButtons } from "./EngineButtons";
import { SurveyElement } from "./engineTypes";

interface FeatureSelectionProps {
  element: SurveyElement;
  field: any;
  register: any;
  control: any;
  onSubmit: () => void;
  disabled: boolean;
  allowSkip: boolean;
  skipAction: () => void;
  autoSubmit: boolean;
  loading: boolean;
}

export default function FeatureSelection({
  element,
  field,
  register,
  allowSkip,
  skipAction,
  autoSubmit,
  loading,
}: FeatureSelectionProps) {
  const shuffledOptions = useMemo(
    () => (element.options ? getShuffledArray(element.options) : []),
    [element.options]
  );

  return (
    <div className={clsx(loading && "formbricks-pulse-animation")}>
      <div className="flex flex-col justify-center">
        <label
          htmlFor={element.id}
          className="pb-6 text-center text-lg font-bold text-slate-600 dark:text-slate-300 sm:text-xl md:text-2xl">
          {element.label}
        </label>
        <fieldset className="space-y-5">
          <legend className="sr-only">{element.label}</legend>
          <div className=" mx-auto grid max-w-5xl grid-cols-1 gap-6 px-2 sm:grid-cols-2">
            {shuffledOptions.map((option) => (
              <label htmlFor={`${element.id}-${option.value}`} key={`${element.id}-${option.value}`}>
                <div className="drop-shadow-card duration-120 relative cursor-default rounded-lg border border-gray-200 bg-white p-6 transition-all ease-in-out hover:scale-105 dark:border-slate-700 dark:bg-slate-700">
                  <div className="absolute right-10">
                    <input
                      id={`${element.id}-${option.value}`}
                      aria-describedby={`${element.id}-${option.value}-description`}
                      type="checkbox"
                      value={option.value}
                      className="text-brand focus:ring-brand border-brand h-5 w-5 rounded border-2 bg-slate-50 dark:bg-slate-600"
                      {...register(element.name!)}
                    />
                  </div>
                  <div className="h-12 w-12">
                    {option.frontend?.icon && <option.frontend.icon className="text-brand h-10 w-10" />}
                  </div>
                  <span className="text-md mt-3 mb-1 font-bold text-slate-700 dark:text-slate-200">
                    {option.label}
                  </span>
                  <p
                    id={`${element.id}-${option.value}-description`}
                    className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {option.frontend.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <EngineButtons allowSkip={allowSkip} skipAction={skipAction} autoSubmit={autoSubmit} />
    </div>
  );
}

function getShuffledArray(array: any[]) {
  const shuffledArray = [...array];
  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }
  return shuffledArray;
}
