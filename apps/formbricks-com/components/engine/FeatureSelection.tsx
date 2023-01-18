import clsx from "clsx";
import { SurveyElement } from "./engineTypes";

interface FeatureSelectionProps {
  element: SurveyElement;
  field: any;
  register: any;
  control: any;
  onSubmit: () => void;
  disabled: boolean;
}

export default function FeatureSelection({ element, field, register }: FeatureSelectionProps) {
  return (
    <div className="flex flex-col justify-center">
      <label htmlFor={element.id} className="mx-auto text-lg font-bold text-gray-700 dark:text-gray-100">
        {element.label}
      </label>
      <fieldset className="space-y-5">
        <legend className="sr-only">{element.label}</legend>
        <div className=" mx-auto grid max-w-5xl grid-cols-1 gap-6 px-2 sm:grid-cols-2">
          {element.options &&
            element.options.map((option) => (
              <label htmlFor={`${element.id}-${option.value}`} key={`${element.id}-${option.value}`}>
                <div className="drop-shadow-card duration-120 relative cursor-default rounded-lg border border-gray-200 bg-white p-6 transition-all ease-in-out hover:scale-105 dark:border-slate-700 dark:bg-slate-700">
                  <div className="absolute right-10">
                    <input
                      id={`${element.id}-${option.value}`}
                      aria-describedby={`${element.id}-${option.value}-description`}
                      type="checkbox"
                      value={option.value}
                      className="text-brand focus:ring-brand h-4 w-4 rounded border-gray-300"
                      {...register(element.field!)}
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
  );
}
