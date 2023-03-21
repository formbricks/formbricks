import { h } from "preact";
import { useState } from "preact/compat";
import { cn } from "../lib/utils";

export default function RadioElement({ element, onSubmit }) {
  const [selected, setSelected] = useState(null);
  return (
    <form>
      <fieldset>
        <legend className="mb-3 w-full text-center text-base font-semibold">{element.label}</legend>
        <div class="space-y-4">
          {element.options.map((option, index) => (
            <label
              class={cn(
                selected === option.value ? " border-slate-900 ring-2 ring-indigo-500" : "border-transparent",
                "relative block cursor-pointer rounded-lg border bg-white px-6 py-4 shadow-sm focus:outline-none sm:flex sm:justify-between"
              )}>
              {/*  Checked: "border-transparent", Not Checked: "border-slate-300"
      Active: "border-indigo-500 ring-2 ring-indigo-500" */}
              <input
                type="radio"
                name={option.value}
                value={option.value}
                class="sr-only"
                onChange={(e) => {
                  setSelected(e.currentTarget.value);
                  onSubmit(e.currentTarget.value);
                }}
                checked={selected === option.value}
                aria-labelledby={`${option.value}-label`}
                aria-describedby="server-size-0-description-0 server-size-0-description-1"
              />
              <span id={`${option.value}-label`} class="text-sm font-medium text-slate-900">
                {option.label}
              </span>
              {/*  Active: "border", Not Active: "border-2"
          Checked: "border-indigo-500", Not Checked: "border-transparent" */}
              <span
                class="pointer-events-none absolute -inset-px rounded-lg border-2"
                aria-hidden="true"></span>
            </label>
          ))}
        </div>
      </fieldset>
    </form>
  );
}
