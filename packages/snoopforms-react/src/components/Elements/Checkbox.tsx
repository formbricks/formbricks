import React, { FC, useContext, useEffect, useState } from 'react';
import { setSubmissionValue } from '../../lib/elements';
import { ClassNames } from '../../types';
import { SubmissionContext } from '../SnoopForm/SnoopForm';
import { PageContext } from '../SnoopPage/SnoopPage';

interface Option {
  label: string;
  value: string;
}

interface Props {
  name: string;
  label?: string;
  help?: string;
  options: (Option | string)[];
  placeholder?: string;
  classNames: ClassNames;
  required?: boolean;
}

export const Checkbox: FC<Props> = ({
  name,
  label,
  help,
  options,
  classNames,
}) => {
  const [checked, setChecked] = useState<string[]>([]);
  const { setSubmission }: any = useContext(SubmissionContext);
  const pageName = useContext(PageContext);

  useEffect(() => {
    setSubmissionValue(checked, pageName, name, setSubmission);
  }, [checked]);

  return (
    <div>
      {label && (
        <label
          className={
            classNames.label || 'block text-sm font-medium text-gray-700'
          }
        >
          {label}
        </label>
      )}
      <div className="mt-2 space-y-2">
        {options.map((option) => (
          <div
            className="relative flex items-start"
            key={typeof option === 'object' ? option.value : option}
          >
            <div className="flex items-center h-5">
              <input
                id={typeof option === 'object' ? option.value : option}
                name={typeof option === 'object' ? option.value : option}
                type="checkbox"
                className={
                  classNames.element ||
                  'focus:ring-slate-500 h-4 w-4 text-slate-600 border-gray-300 rounded-sm'
                }
                checked={
                  typeof option === 'object'
                    ? checked.includes(option.value)
                    : checked.includes(option)
                }
                onChange={(e) => {
                  const newChecked: string[] = [...checked];
                  const value =
                    typeof option === 'object' ? option.value : option;
                  if (e.target.checked) {
                    newChecked.push(value);
                  } else {
                    const idx = newChecked.findIndex((v) => v === value);
                    if (idx >= 0) {
                      newChecked.splice(idx, 1);
                    }
                  }
                  setChecked(newChecked);
                  setSubmissionValue(newChecked, pageName, name, setSubmission);
                }}
              />
            </div>
            <div className="ml-3 text-base">
              <label
                htmlFor={typeof option === 'object' ? option.value : option}
                className={
                  classNames.elementLabel || 'font-medium text-gray-700'
                }
              >
                {typeof option === 'object' ? option.label : option}
              </label>
            </div>
          </div>
        ))}
      </div>
      {help && (
        <p className={classNames.help || 'mt-2 text-sm text-gray-500'}>
          {help}
        </p>
      )}
    </div>
  );
};
