/* This example requires Tailwind CSS v2.0+ */
import { Dialog, RadioGroup, Transition } from "@headlessui/react";
import { CheckCircleIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/router";
import { Fragment, useState } from "react";
import { BsPlus } from "react-icons/bs";
import { createForm } from "../../lib/forms";
import { createNoCodeForm } from "../../lib/noCodeForm";
import { classNames } from "../../lib/utils";
import StandardButton from "../StandardButton";

const formTypes = [
  {
    id: "NOCODE",
    title: "No-Code Builder",
    description: "Use the Notion-like builder to build your form without a single line of code.",
  },
  {
    id: "CODE",
    title: "Code",
    description: "Use the snoopReact library to code the form yourself and manage the data here.",
    additionalDescription: "",
  },
];

type FormOnboardingModalProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

export default function NewFormModal({ open, setOpen }: FormOnboardingModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [formType, setFormType] = useState(formTypes[0]);

  const createFormAction = async (e) => {
    e.preventDefault();
    const form = await createForm({
      name,
      formType: formType.id,
    });
    if (form.formType === "NOCODE") {
      await createNoCodeForm(form.id);
    }
    router.push(`/forms/${form.id}/form`);
  };

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={setOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-30 backdrop-blur-md transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
              <Dialog.Panel className="relative transform rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-0 focus:ring-offset-2"
                    onClick={() => setOpen(false)}>
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                <div className="flex flex-row justify-between">
                  <h2 className="text-ui-gray-dark flex-none p-2 text-xl font-bold">Create new form</h2>
                </div>
                <form
                  onSubmit={(e) => createFormAction(e)}
                  className="inline-block w-full transform overflow-hidden p-2 text-left align-bottom transition-all sm:align-middle">
                  <div>
                    <label htmlFor="email" className="text-ui-gray-dark text-sm font-light">
                      Name your form
                    </label>
                    <div className="mt-2">
                      <input
                        type="text"
                        name="name"
                        className="bg-ui-gray-light focus:ring-red placeholder:text-ui-gray-medium mb-6 block w-full rounded border-none p-2 placeholder:font-extralight focus:ring-2 sm:text-sm"
                        placeholder="e.g. Customer Research Survey"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus
                        required
                      />
                    </div>
                  </div>

                  <RadioGroup value={formType} onChange={setFormType}>
                    <RadioGroup.Label className="text-ui-gray-dark text-sm font-light">
                      How do you build your form?
                    </RadioGroup.Label>

                    <div className="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
                      {formTypes.map((formType) => (
                        <RadioGroup.Option
                          key={formType.id}
                          value={formType}
                          className={({ checked, active }) =>
                            classNames(
                              checked ? "border-transparent" : "",
                              active ? "border-red ring-red ring-2" : "bg-ui-gray-lighter",
                              "relative flex cursor-pointer rounded border bg-white p-4 shadow-sm focus:outline-none"
                            )
                          }>
                          {({ checked, active }) => (
                            <>
                              <span className="flex flex-1">
                                <span className="flex flex-col">
                                  <RadioGroup.Label
                                    as="span"
                                    className="text-md text-ui-gray-dark block font-bold">
                                    {formType.title}
                                  </RadioGroup.Label>
                                  <RadioGroup.Description
                                    as="span"
                                    className="text-ui-gray-dark mt-1 flex items-center whitespace-pre-wrap text-xs">
                                    {formType.description}
                                  </RadioGroup.Description>
                                </span>
                              </span>
                              <CheckCircleIcon
                                className={classNames(!checked ? "hidden" : "", "text-red h-5 w-5")}
                                aria-hidden="true"
                              />
                              <div
                                className={classNames(
                                  checked ? "hidden" : "",
                                  "border-ui-gray-light h-4 w-4 rounded-full border-2"
                                )}
                                aria-hidden="true"
                              />
                              <span
                                className={classNames(
                                  active ? "border" : "border-2",
                                  checked ? "border-red" : "border-transparent",
                                  "pointer-events-none absolute -inset-px rounded"
                                )}
                                aria-hidden="true"
                              />
                            </>
                          )}
                        </RadioGroup.Option>
                      ))}
                    </div>
                  </RadioGroup>
                  <div className="mt-5 sm:mt-6">
                    <StandardButton fullwidth type="submit">
                      create form
                      <BsPlus className="ml-1 h-6 w-6"></BsPlus>
                    </StandardButton>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
