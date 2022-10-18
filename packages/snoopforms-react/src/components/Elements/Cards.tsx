import { RadioGroup } from "@headlessui/react";
import React, { FC, useContext, useEffect, useState } from "react";
import { getOptionValue, setSubmissionValue } from "../../lib/elements";
import { classNamesConcat } from "../../lib/utils";
import { ClassNames, Option } from "../../types";
import { SubmissionContext, SubmitHandlerContext } from "../SnoopForm/SnoopForm";
import { PageContext } from "../SnoopPage/SnoopPage";

interface Props {
  name: string;
  label?: string;
  help?: string;
  cols?: number;
  autoSubmit?: boolean;
  options: (Option | string)[];
  placeholder?: string;
  classNames: ClassNames;
  required?: boolean;
}

export const Cards: FC<Props> = ({ name, label, help, cols, autoSubmit, options, classNames }) => {
  const { submission, setSubmission }: any = useContext(SubmissionContext);
  const handleSubmit = useContext(SubmitHandlerContext);
  const pageName = useContext(PageContext);
  const [triggerSubmit, setTriggerSubmit] = useState(false);

  useEffect(() => {
    if (triggerSubmit) {
      handleSubmit(pageName);
      setTriggerSubmit(false);
    }
  }, [triggerSubmit]);

  return (
    <div>
      {label && (
        <label className={classNames.label || "block text-sm font-medium text-gray-700"}>{label}</label>
      )}
      <RadioGroup
        value={submission[pageName] ? submission[pageName][name] : undefined}
        onChange={(v: string) => {
          setSubmissionValue(getOptionValue(v), pageName, name, setSubmission);
          if (autoSubmit) {
            // trigger submit at next rerender to await setSubmissionValue()
            setTriggerSubmit(true);
          }
        }}
        className="mt-2">
        <RadioGroup.Label className="sr-only">Choose an option</RadioGroup.Label>
        <div
          className={classNamesConcat(
            "grid gap-3",
            (cols && cols === 1) || options.length === 1
              ? "grid-cols-1"
              : (cols && cols === 2) || options.length === 2
              ? "grid-cols-2"
              : (cols && cols === 3) || options.length === 3
              ? "grid-cols-3"
              : (cols && cols === 4) || options.length === 4
              ? "grid-cols-4"
              : (cols && cols === 5) || options.length === 5
              ? "grid-cols-5"
              : (cols && cols === 6) || options.length === 6
              ? "grid-cols-6"
              : (cols && cols === 7) || options.length === 7
              ? "grid-cols-7"
              : (cols && cols === 8) || options.length === 8
              ? "grid-cols-8"
              : (cols && cols === 9) || options.length === 9
              ? "grid-cols-9"
              : cols === 10
              ? "grid-cols-10"
              : "grid-cols-1 sm:grid-cols-6"
          )}>
          {options.map((option) => (
            <RadioGroup.Option
              key={getOptionValue(option)}
              id={`${name}-${getOptionValue(option)}`}
              value={option}
              className={({ active, checked }) =>
                classNamesConcat(
                  "cursor-pointer focus:outline-none",
                  active ? "ring-2 ring-gray-500 ring-offset-2" : "",
                  checked
                    ? "border-transparent bg-gray-600 text-white hover:bg-gray-700"
                    : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                  "flex items-center justify-center rounded-md border py-3 px-3 text-sm font-medium uppercase sm:flex-1"
                )
              }>
              <RadioGroup.Label as="span">{getOptionValue(option)}</RadioGroup.Label>
            </RadioGroup.Option>
          ))}
        </div>
      </RadioGroup>
      {help && <p className={classNames.help || "mt-2 text-sm text-gray-500"}>{help}</p>}
    </div>
  );
};
