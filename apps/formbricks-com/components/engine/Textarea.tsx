import { RadioGroup } from "@headlessui/react";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { SurveyQuestion } from "./engineTypes";

interface TextareaProps {
  question: SurveyQuestion;
  value: any;
  setValue: (v: any) => void;
  onSubmit: () => void;
}

export default function Textarea({ question, value, setValue, onSubmit }: TextareaProps) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      //setValue(question.options[0].value);
      setInitialized(true);
    }
  }, [initialized, question.options, setValue]);
  return (
    <div>
      <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
        Add your comment
      </label>
      <div className="mt-1">
        <textarea
          rows={4}
          name="comment"
          id="comment"
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          value={value || ""}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
    </div>
  );
}
