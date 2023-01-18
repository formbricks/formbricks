import { useEffect, useState } from "react";
import { SurveyElement } from "./engineTypes";

interface TextareaProps {
  element: SurveyElement;
  register: any;
  onSubmit: () => void;
}

export default function Textarea({ element, register, onSubmit }: TextareaProps) {
  return (
    <div className="flex flex-col justify-center">
      <label htmlFor={element.id} className="mx-auto text-lg font-bold text-gray-700 dark:text-gray-100">
        {element.label}
      </label>
      <textarea
        rows={element.frontend?.rows || 4}
        className="focus:border-brand focus:ring-brand mx-auto mt-4 block w-full max-w-xl rounded-md border-gray-300 shadow-sm sm:text-sm"
        placeholder={element.frontend?.placeholder || ""}
        required={!!element.frontend?.required}
        {...register(element.name!)}
      />
    </div>
  );
}
