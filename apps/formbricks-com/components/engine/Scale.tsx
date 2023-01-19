import { RadioGroup } from "@headlessui/react";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { SurveyElement } from "./engineTypes";

interface IconRadioProps {
  element: SurveyElement;
  field: any;
  control: any;
  onSubmit: () => void;
  disabled: boolean;
}

export default function Scale({ element, control, onSubmit, disabled }: IconRadioProps) {
  const value = useWatch({
    control,
    name: element.name!!,
  });

  useEffect(() => {
    if (value && !disabled) {
      onSubmit();
    }
  }, [value, onSubmit, disabled]);
  return (
    <Controller
      name={element.name!}
      control={control}
      rules={{ required: true }}
      render={({ field }: { field: any }) => (
        <RadioGroup className="flex flex-col justify-center" {...field}>
          <RadioGroup.Label className="pb-6 text-center text-lg font-bold text-slate-600 dark:text-slate-300 sm:text-xl md:text-2xl">
            {element.label}
          </RadioGroup.Label>
          <div
            className={clsx(
              element.frontend.max &&
                element.frontend.min &&
                element.frontend.max - element.frontend.min + 1 >= 11
                ? "lg:grid-cols-11"
                : element.frontend.max - element.frontend.min + 1 === 10
                ? "lg:grid-cols-10"
                : element.frontend.max - element.frontend.min + 1 === 9
                ? "lg:grid-cols-9"
                : element.frontend.max - element.frontend.min + 1 === 8
                ? "lg:grid-cols-8"
                : element.frontend.max - element.frontend.min + 1 === 7
                ? "lg:grid-cols-7"
                : element.frontend.max - element.frontend.min + 1 === 6
                ? "lg:grid-cols-6"
                : element.frontend.max - element.frontend.min + 1 === 5
                ? "lg:grid-cols-5"
                : element.frontend.max - element.frontend.min + 1 === 4
                ? "lg:grid-cols-4"
                : element.frontend.max - element.frontend.min + 1 === 3
                ? "lg:grid-cols-3"
                : element.frontend.max - element.frontend.min + 1 === 2
                ? "lg:grid-cols-2"
                : "lg:grid-cols-1",
              "mt-4 grid w-full gap-y-6 sm:gap-x-2"
            )}>
            {Array.from(
              { length: element.frontend.max - element.frontend.min + 1 },
              (_, i) => i + element.frontend.min
            ).map((num) => (
              <RadioGroup.Option
                key={num}
                value={num}
                className={({ checked, active }) =>
                  clsx(
                    checked ? "border-transparent" : "border-gray-200 dark:border-slate-700",
                    active ? "border-brand ring-brand ring-2" : "",
                    "relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition-all ease-in-out hover:scale-105 focus:outline-none dark:bg-slate-700"
                  )
                }>
                {({ checked, active }) => (
                  <>
                    <div className="flex flex-1 flex-col justify-center">
                      <RadioGroup.Label
                        as="span"
                        className="mx-auto text-sm font-medium text-gray-900 dark:text-gray-200">
                        {num}
                      </RadioGroup.Label>
                    </div>

                    <CheckCircleIcon
                      className={clsx(
                        !checked ? "invisible" : "",
                        "text-brand absolute -right-2 -top-2 z-10 h-5 w-5 rounded-full bg-white"
                      )}
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
          <div className="mt-2 flex justify-between text-sm text-gray-800">
            <p>{element.frontend.minLabel}</p>
            <p>{element.frontend.maxLabel}</p>
          </div>
        </RadioGroup>
      )}
    />
  );
}
