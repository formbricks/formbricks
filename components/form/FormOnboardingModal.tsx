/* This example requires Tailwind CSS v2.0+ */
import { Dialog, RadioGroup, Transition } from "@headlessui/react";
import { LightBulbIcon } from "@heroicons/react/outline";
import { CheckCircleIcon } from "@heroicons/react/solid";
import { Fragment, useState } from "react";
import { persistForm, useForm } from "../../lib/forms";
import { classNames } from "../../lib/utils";
import Loading from "../Loading";

const formTypes = [
  {
    id: "NOCODE",
    title: "No-Code Builder",
    description:
      "Use our Notion-like form builder to build your form without a single line of code.",
  },
  {
    id: "CODE",
    title: "Code",
    description: "Use our snoopReact library to code the form yourself.",
    additionalDescription: "",
  },
];

type FormOnboardingModalProps = {
  open: boolean;
  setOpen: (o: boolean) => void;
  formId: string;
};

export default function FormOnboardingModal({
  open,
  setOpen,
  formId,
}: FormOnboardingModalProps) {
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
    setOpen(false);
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
            <Dialog.Overlay className="fixed inset-0 transition-opacity bg-darkgray-500 bg-opacity-10 backdrop-blur" />
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
              className="inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-xl sm:w-full sm:p-6"
            >
              {/* <div>
                <div className="flex items-center justify-center w-12 h-12 mx-auto bg-snoopred-100 rounded-full">
                  <LightBulbIcon
                    className="w-6 h-6 text-snoopred"
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-darkgray-700"
                  >
                    Create a new form
                  </Dialog.Title>
                </div>
              </div> 
              <hr className="my-4" /> */}
              <div>
                <label
                  htmlFor="email"
                  className="text-sm text-darkgray-500"
                >
                  Name your form
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="name"
                    className="block w-full p-1 rounded-lg focus:ring-2 focus:ring-snoopred sm:text-lg mb-8"
                    placeholder="e.g. Customer Research Survey"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
              {/* <hr className="my-5" /> */}
              <RadioGroup value={formType} onChange={setFormType}>
                <RadioGroup.Label className="text-sm text-darkgray-500">
                  How would you like to build your form?
                </RadioGroup.Label>

                <div className="grid grid-cols-1 mt-4 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
                  {formTypes.map((formType) => (
                    <RadioGroup.Option
                      key={formType.id}
                      value={formType}
                      className={({ checked, active }) =>
                        classNames(
                          checked ? "border-transparent" : "border-lightgray-300",
                          active ? "border-snoopred ring-2 ring-snoopred" : "",
                          "relative bg-white border rounded-lg shadow-sm p-4 flex cursor-pointer focus:outline-none"
                        )
                      }
                    >
                      {({ checked, active }) => (
                        <>
                          <span className="flex flex-1">
                            <span className="flex flex-col">
                              <RadioGroup.Label
                                as="span"
                                className="block text-lg font-medium text-darkgray-900"
                              >
                                {formType.title}
                              </RadioGroup.Label>
                              <RadioGroup.Description
                                as="span"
                                className="flex items-center mt-1 text-sm text-darkgray-500 whitespace-pre-wrap"
                              >
                                {formType.description}
                              </RadioGroup.Description>
                              <RadioGroup.Description
                                as="span"
                                className="flex items-center mt-1 text-xs text-darkgray-500-400 whitespace-pre-wrap"
                              >
                                {formType.additionalDescription}
                              </RadioGroup.Description>
                            </span>
                          </span>
                          <CheckCircleIcon
                            className={classNames(
                              !checked ? "invisible" : "",
                              "h-5 w-5 text-snoopred"
                            )}
                            aria-hidden="true"
                          />
                          <span
                            className={classNames(
                              active ? "border" : "border-2",
                              checked ? "border-snoopred" : "border-transparent",
                              "absolute -inset-px rounded-lg pointer-events-none"
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
                <button
                  type="submit"
                  className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-snoopred border border-transparent rounded-md shadow-sm hover:bg-snoopred-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-snoopred sm:text-sm"
                >
                  Create form
                </button>
              </div>
            </form>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
