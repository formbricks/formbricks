import clsx from "clsx";
import { useEffect, useState } from "react";
import { EngineButtons } from "./EngineButtons";
import { SurveyElement } from "./engineTypes";

interface TextareaProps {
  element: SurveyElement;
  register: any;
  onSubmit: () => void;
  allowSkip: boolean;
  skipAction: () => void;
  autoSubmit: boolean;
  loading: boolean;
}

export default function Textarea({
  element,
  register,
  onSubmit,
  allowSkip,
  skipAction,
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
        <textarea
          rows={element.frontend?.rows || 4}
          className="focus:border-brand focus:ring-brand mx-auto mt-4 block w-full max-w-xl rounded-md border-slate-300 text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 sm:text-sm"
          placeholder={element.frontend?.placeholder || ""}
          required={!!element.frontend?.required}
          {...register(element.name!)}
        />
      </div>
      <EngineButtons allowSkip={allowSkip} skipAction={skipAction} autoSubmit={autoSubmit} />
    </div>
  );
}
