/* This example requires Tailwind CSS v2.0+ */
import { Dialog, RadioGroup, Transition } from "@headlessui/react";
import { CheckCircleIcon, XIcon } from "@heroicons/react/solid";
import { useRouter } from "next/router";
import { Fragment, useState } from "react";
import { persistForm, useForm } from "../../lib/forms";
import { createNoCodeForm } from "../../lib/noCodeForm";
import { classNames } from "../../lib/utils";
import Loading from "../Loading";
import StandardButton from "../StandardButton";
import { BsPlus } from "react-icons/bs";

const formTypes = [
  {
    id: "NOCODE",
    title: "No-Code Builder",
    description:
      "Use the Notion-like builder to build your form without a single line of code.",
  },
  {
    id: "CODE",
    title: "Code",
    description:
      "Use the snoopReact library to code the form yourself and manage the data here.",
    additionalDescription: "",
  },
];

type FormOnboardingModalProps = {
  open: boolean;
  formId: string;
};

export default function FormOnboardingModal({
  open,
  formId,
}: FormOnboardingModalProps) {
  const router = useRouter();
  const { form, mutateForm, isLoadingForm } = useForm(formId);
  const [name, setName] = useState(form.name);
  const [formType, setFormType] = useState(formTypes[0]);

  const submitForm = async (e) => {
    e.preventDefault();
    const updatedForm = {
      ...form,
      name,
      finishedOnboarding: true,
      formType: formType.id,
    };
    await persistForm(updatedForm);
    mutateForm(updatedForm);
    if (updatedForm.formType === "NOCODE") {
      await createNoCodeForm(formId);
    }
    router.push(`/forms/${formId}/form`);
  };

  if (isLoadingForm) {
    return <Loading />;
  }

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog
        as="div"
        static
        className="fixed inset-0 z-10 overflow-y-auto"
        open={open}
        onClose={() => {}}
      >
        <div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 transition-opacity bg-ui-gray-medium bg-opacity-10 backdrop-blur" />
          </Transition.Child>

          {/* This element is to trick the browser into centering the modal contents. */}
          <span
            className="hidden sm:inline-block sm:align-middle sm:h-screen"
            aria-hidden="true"
          >
            &#8203;
          </span>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <form
              onSubmit={(e) => submitForm(e)}
              className="inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-md shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6"
            >
              <div className="flex flex-row justify-between">
                <h2 className="flex-none pb-4 text-xl font-bold text-ui-gray-dark">
                  Create new form
                </h2>
                <XIcon className="flex-initial w-6 h-6 stroke-1 text-ui-gray-light" />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="text-sm font-light text-ui-gray-dark"
                >
                  Name your form
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="name"
                    className="block w-full p-2 mb-8 border-none rounded bg-ui-gray-light focus:ring-2 focus:ring-red sm:text-sm placeholder:font-extralight placeholder:text-ui-gray-medium"
                    placeholder="e.g. Customer Research Survey"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <RadioGroup value={formType} onChange={setFormType}>
                <RadioGroup.Label className="text-sm font-light text-ui-gray-dark">
                  How do you build your form?
                </RadioGroup.Label>

                <div className="grid grid-cols-1 mt-4 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
                  {formTypes.map((formType) => (
                    <RadioGroup.Option
                      key={formType.id}
                      value={formType}
                      className={({ checked, active }) =>
                        classNames(
                          checked ? "border-transparent" : "",
                          active
                            ? "border-red ring-2 ring-red"
                            : "bg-ui-gray-lighter",
                          "relative bg-white border rounded shadow-sm p-4 flex cursor-pointer focus:outline-none"
                        )
                      }
                    >
                      {({ checked, active }) => (
                        <>
                          <span className="flex flex-1">
                            <span className="flex flex-col">
                              <RadioGroup.Label
                                as="span"
                                className="block font-bold text-md text-ui-gray-dark"
                              >
                                {formType.title}
                              </RadioGroup.Label>
                              <RadioGroup.Description
                                as="span"
                                className="flex items-center mt-1 text-xs whitespace-pre-wrap text-ui-gray-dark"
                              >
                                {formType.description}
                              </RadioGroup.Description>
                            </span>
                          </span>
                          <CheckCircleIcon
                            className={classNames(
                              !checked ? "hidden" : "",
                              "h-5 w-5 text-red"
                            )}
                            aria-hidden="true"
                          />
                          <div
                            className={classNames(
                              checked ? "hidden" : "",
                              "h-4 w-4 rounded-full border-2 border-ui-gray-light"
                            )}
                            aria-hidden="true"
                          />
                          <span
                            className={classNames(
                              active ? "border" : "border-2",
                              checked ? "border-red" : "border-transparent",
                              "absolute -inset-px rounded pointer-events-none"
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
                  <BsPlus className="w-6 h-6 ml-1"></BsPlus>
                </StandardButton>
              </div>
            </form>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
