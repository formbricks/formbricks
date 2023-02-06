import clsx from "clsx";
import { EngineButtons } from "./EngineButtons";
import { SurveyElement } from "./engineTypes";

interface TextareaProps {
  element: SurveyElement;
  field: any;
  register: any;
  disabled: boolean;
  allowSkip: boolean;
  skipAction: () => void;
  onSubmit: () => void;
  autoSubmit: boolean;
  loading: boolean;
}

export default function Input({
  element,
  field,
  register,
  disabled,
  onSubmit,
  skipAction,
  allowSkip,
  autoSubmit,
  loading,
}: TextareaProps) {
  return (
    <div className={clsx(loading && "formbricks-pulse-animation")}>
      <div className="flex flex-col justify-center">
        <label
          htmlFor={element.id}
          className="pb-6 text-center text-lg font-bold text-slate-600 dark:text-slate-300 sm:text-xl md:text-2xl">
          {element.label}
        </label>
        <input
          type={element.frontend?.type || "text"}
          onBlur=""
          className="focus:border-brand focus:ring-brand mx-auto mt-4 block w-full max-w-xl rounded-md border-gray-300 text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 dark:focus:bg-slate-700 dark:active:bg-slate-700 sm:text-sm"
          placeholder={element.frontend?.placeholder || ""}
          required={!!element.frontend?.required}
          {...register(element.name!)}
        />
      </div>
      <EngineButtons allowSkip={allowSkip} skipAction={skipAction} autoSubmit={autoSubmit} />
    </div>
  );
}
