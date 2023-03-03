import { RadioGroup } from "@headlessui/react";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { useEffect } from "react";
import { Controller, useWatch } from "react-hook-form";

interface IconRadioProps {
  element: any;
  field: any;
  control: any;
  onSubmit: () => void;
  disabled: boolean;
}

export default function IconRadio({ element, control, onSubmit, disabled }: IconRadioProps) {
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
          <RadioGroup.Label className="max-w-sm pb-1 text-center font-medium text-slate-600">
            {element.label}
          </RadioGroup.Label>
          <div className="mx-auto -mt-3 mb-3 text-center text-sm text-slate-500 dark:text-slate-300 md:max-w-lg">
            {element.help}
          </div>

          <div className="mt-4 grid w-full grid-cols-1 gap-y-2 sm:gap-x-4">
            {element.options &&
              element.options.map((option) => (
                <RadioGroup.Option
                  key={option.value}
                  value={option.value}
                  className={({ checked }) =>
                    clsx(
                      checked ? "border-transparent" : "border-slate-200 ",
                      /* active ? "border-brand ring-brand ring-2" : "", */
                      "relative flex cursor-pointer rounded-lg border bg-slate-50 py-2 shadow-sm transition-all ease-in-out hover:scale-105 focus:outline-none"
                    )
                  }>
                  {({ checked, active }) => (
                    <>
                      <div className="flex flex-1 flex-col justify-center text-slate-500 hover:text-slate-700 ">
                        {option.frontend?.icon && (
                          <option.frontend.icon
                            className="text-brand mx-auto mb-3 h-8 w-8"
                            aria-hidden="true"
                          />
                        )}
                        <RadioGroup.Label as="span" className="mx-auto text-sm font-medium ">
                          {option.label}
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
        </RadioGroup>
      )}
    />
  );
}
