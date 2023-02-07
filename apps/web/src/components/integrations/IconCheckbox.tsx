import { SurveyElement } from "./engineTypes";

interface IconCheckboxProps {
  element: SurveyElement;
  field: any;
  register: any;
  control: any;
  onSubmit: () => void;
  disabled: boolean;
}

export default function IconCheckbox({ element, register }: IconCheckboxProps) {
  return (
    <div className="flex flex-col justify-center">
      <label
        htmlFor={element.id}
        className="pb-6 text-center text-lg font-bold text-slate-600 dark:text-slate-300 sm:text-xl md:text-2xl">
        {element.label}
      </label>
      <fieldset className="space-y-5">
        <legend className="sr-only">{element.label}</legend>
        <div className="flex max-w-5xl space-x-3 px-2">
          {element.options &&
            element.options.map((option) => (
              <label htmlFor={`${element.id}-${option.value}`} key={`${element.id}-${option.value}`}>
                <div className="drop-shadow-card duration-120 relative w-32 cursor-default rounded-lg border border-gray-200 bg-white p-6 text-center transition-all ease-in-out hover:scale-105">
                  <div className="absolute right-4 top-3">
                    <input
                      id={`${element.id}-${option.value}`}
                      aria-describedby={`${element.id}-${option.value}-description`}
                      type="checkbox"
                      value={option.value}
                      className="text-brand-dark focus:ring-brand-dark border-brand-dark  h-5 w-5 rounded border-2 bg-slate-100"
                      {...register(element.name!)}
                    />
                  </div>
                  <div className="mx-auto my-4 h-12 w-12">
                    {option.frontend?.icon && <option.frontend.icon />}
                  </div>
                  <span className="mt-3 mb-1 text-sm text-slate-500">{option.label}</span>
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
