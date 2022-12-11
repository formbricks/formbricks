import { Button, Form, Radio, sendToHq, Submit, Text, Textarea } from "@formbricks/react";
import { Dialog, Transition } from "@headlessui/react";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { Fragment, useRef, useState } from "react";

export default function PmfModal({ open, setOpen }) {
  const cancelButtonRef = useRef(null);
  const [formStep, setFormStep] = useState(0);

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-10" initialFocus={cancelButtonRef} onClose={setOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0">
          <div className="transition-blur fixed inset-0 bg-gray-500 bg-opacity-50" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center backdrop-blur sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center">
                    <QuestionMarkCircleIcon className="h-10 w-10 text-slate-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <Form
                      formId="clbgqrwsb000019waqru2wzto"
                      hqUrl="http://localhost:3000"
                      onSubmit={sendToHq}>
                      {formStep === 0 ? (
                        <>
                          <Radio
                            name="disappointed"
                            label="How would you feel if you could no longer use Formbricks?"
                            options={["Very disappointed", "Somewhat disappointed", "Not disappointed"]}
                          />
                          <Button label="Continue" onClick={() => setFormStep(formStep + 1)} />
                        </>
                      ) : formStep === 1 ? (
                        <>
                          <Textarea
                            name="targetgroup"
                            label="What type of people do you think would most benefit from Superhuman?"
                          />
                          <Button label="Continue" onClick={() => setFormStep(formStep + 1)} />
                        </>
                      ) : formStep === 2 ? (
                        <>
                          <Textarea
                            name="benefit"
                            label="What is the main benefit you receive from Superhuman?"
                          />
                          <Button label="Continue" onClick={() => setFormStep(formStep + 1)} />
                        </>
                      ) : formStep === 3 ? (
                        <>
                          <Textarea name="improvements" label="How can we improve Superhuman for you?" />
                          <Submit label="Submit" />
                        </>
                      ) : null}
                    </Form>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
