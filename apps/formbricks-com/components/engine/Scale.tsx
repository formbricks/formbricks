import { RadioGroup } from "@headlessui/react";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { EngineButtons } from "./EngineButtons";
import { SurveyElement } from "./engineTypes";

interface IconRadioProps {
  element: SurveyElement;
  field: any;
  control: any;
  onSubmit: () => void;
  disabled: boolean;
  allowSkip: boolean;
  skipAction: () => void;
  autoSubmit: boolean;
  loading: boolean;
}

export default function Scale({
  element,
  control,
  onSubmit,
  disabled,
  allowSkip,
  skipAction,
  autoSubmit,
  loading,
}: IconRadioProps) {
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
    <div className={clsx(loading && "formbricks-pulse-animation")}>
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
                  ? "grid-cols-11"
                  : element.frontend.max - element.frontend.min + 1 === 10
                  ? "grid-cols-10"
                  : element.frontend.max - element.frontend.min + 1 === 9
                  ? "grid-cols-9"
                  : element.frontend.max - element.frontend.min + 1 === 8
                  ? "grid-cols-8"
                  : element.frontend.max - element.frontend.min + 1 === 7
                  ? "grid-cols-7"
                  : element.frontend.max - element.frontend.min + 1 === 6
                  ? "grid-cols-6"
                  : element.frontend.max - element.frontend.min + 1 === 5
                  ? "grid-cols-5"
                  : element.frontend.max - element.frontend.min + 1 === 4
                  ? "grid-cols-4"
                  : element.frontend.max - element.frontend.min + 1 === 3
                  ? "grid-cols-3"
                  : element.frontend.max - element.frontend.min + 1 === 2
                  ? "grid-cols-2"
                  : "grid-cols-1",
                "mt-4 grid w-full gap-x-1  sm:gap-x-2"
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
                      checked ? "border-transparent" : "border-slate-200 dark:border-slate-700",
                      active ? "border-brand ring-brand ring-2" : "",
                      "xs:rounded-lg relative flex cursor-pointer rounded-md border bg-white py-3 shadow-sm transition-all ease-in-out hover:scale-105 focus:outline-none dark:bg-slate-700 sm:p-4"
                    )
                  }>
                  {({ checked, active }) => (
                    <>
                      <div className="flex flex-1 flex-col justify-center">
                        <RadioGroup.Label
                          as="span"
                          className="mx-auto text-sm font-medium text-slate-900 dark:text-slate-200">
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
            <div className="xs:text-sm mt-2 flex justify-between  text-xs text-slate-700 dark:text-slate-400">
              <p>{element.frontend.minLabel}</p>
              <p>{element.frontend.maxLabel}</p>
            </div>
          </RadioGroup>
        )}
      />
      <EngineButtons allowSkip={allowSkip} skipAction={skipAction} autoSubmit={autoSubmit} />
    </div>
  );
}
