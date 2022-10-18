import React, { FC, useContext } from "react";
import { getOptionValue, setSubmissionValue } from "../../lib/elements";
import { ClassNames, Option } from "../../types";
import { SubmissionContext } from "../SnoopForm/SnoopForm";
import { PageContext } from "../SnoopPage/SnoopPage";

interface Props {
  name: string;
  label?: string;
  help?: string;
  options: (Option | string)[];
  placeholder?: string;
  classNames: ClassNames;
  required?: boolean;
}

export const Radio: FC<Props> = ({ name, label, help, options, classNames }) => {
  const { setSubmission }: any = useContext(SubmissionContext);
  const pageName = useContext(PageContext);

  return (
    <div>
      {label && (
        <label className={classNames.label || "block text-sm font-medium text-gray-700"}>{label}</label>
      )}
      <fieldset className="mt-2">
        <legend className="sr-only">Please choose an option</legend>
        <div className="space-y-2">
          {options.map((option) => (
            <div key={getOptionValue(option)} className="flex items-center">
              <input
                id={`${name}-${getOptionValue(option)}`}
                name={name}
                type="radio"
                className={
                  classNames.element || "h-4 w-4 border-gray-300 text-slate-600 focus:ring-slate-500"
                }
                onClick={() => setSubmissionValue(getOptionValue(option), pageName, name, setSubmission)}
              />
              <label
                htmlFor={`${name}-${typeof option === "object" ? option.value : option}`}
                className={classNames.elementLabel || "ml-3 block text-base font-medium text-gray-700"}>
                {typeof option === "object" ? option.label : option}
              </label>
            </div>
          ))}
        </div>
      </fieldset>
      {help && <p className={classNames.help || "mt-2 text-sm text-gray-500"}>{help}</p>}
    </div>
  );
};
