import { RadioGroup } from "@headlessui/react";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { SurveyQuestion } from "./engineTypes";

interface IconRadioProps {
  question: SurveyQuestion;
  value: any;
  setValue: (v: any) => void;
  onSubmit: () => void;
}

export default function IconRadio({ question, value, setValue, onSubmit }: IconRadioProps) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      //setValue(question.options[0].value);
      setInitialized(true);
    }
  }, [initialized, question.options, setValue]);
  return (
    <RadioGroup
      value={value}
      onChange={(v) => {
        setValue(v);
        onSubmit();
      }}>
      <RadioGroup.Label className="text-base font-medium text-gray-900 dark:text-gray-100">
        {question.label}
      </RadioGroup.Label>

      <div className="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-3 sm:gap-x-4">
        {question.options.map((option) => (
          <RadioGroup.Option
            key={option.value}
            value={option.value}
            className={({ checked, active }) =>
              clsx(
                checked ? "border-transparent" : "border-gray-300",
                active ? "border-brand ring-brand ring-2" : "",
                "relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none"
              )
            }>
            {({ checked, active }) => (
              <>
                <span className="flex flex-1">
                  <span className="flex flex-col">
                    <RadioGroup.Label as="span" className="block text-sm font-medium text-gray-900">
                      {option.label}
                    </RadioGroup.Label>
                  </span>
                </span>
                <CheckCircleIcon
                  className={clsx(!checked ? "invisible" : "", "text-brand h-5 w-5")}
                  aria-hidden="true"
                />
                <span
                  className={clsx(
                    active ? "border" : "border-2",
                    checked ? "border-brand" : "border-transparent",
                    "pointer-events-none absolute -inset-px rounded-lg"
                  )}
                  aria-hidden="true"
                />
              </>
            )}
          </RadioGroup.Option>
        ))}
      </div>
    </RadioGroup>
  );
}
