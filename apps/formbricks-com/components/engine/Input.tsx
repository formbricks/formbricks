import { useEffect, useState } from "react";
import { SurveyElement } from "./engineTypes";

interface TextareaProps {
  element: SurveyElement;
  value: any;
  setValue: (v: any) => void;
  onSubmit: () => void;
}

export default function Input({ element, value, setValue, onSubmit }: TextareaProps) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      //setValue(element.options[0].value);
      setInitialized(true);
    }
  }, [initialized, element.options, setValue]);
  return (
    <div>
      <label htmlFor="comment" className="text-lg font-bold text-gray-700 dark:text-gray-100">
        {element.label}
      </label>
      <div className="mt-1">
        <input
          type="email"
          name="email"
          id="email"
          className="focus:border-brand focus:ring-brand block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
          value={value || ""}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
    </div>
  );
}
