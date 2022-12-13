import { Form, Nps, sendToHq, Submit, Textarea } from "@formbricks/react";
import { Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { Fragment, useEffect } from "react";
import { toast } from "react-toastify";

export default function FeedbackModal({ show, setShow }) {
  return (
    <>
      {/* Global notification live region, render this permanently at the end of the document */}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-end sm:p-6">
        <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
          {/* Notification panel, dynamically insert this into the live region when it needs to be displayed */}
          <Transition
            show={show}
            as={Fragment}
            enter="transform ease-out duration-300 transition"
            enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
            enterTo="translate-y-0 opacity-100 sm:translate-x-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0">
            <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
              <div className="p-4">
                <div className="flex items-start">
                  <div className="ml-3 w-0 flex-1 pt-0.5">
                    <p className="text-sm font-medium text-gray-900">We would like to hear your feedback</p>
                    <div className="mt-3 flex space-x-7">
                      <Form
                        formId="clbmck9t90000yznpabjc4j9f"
                        hqUrl="http://localhost:3000"
                        customerId="johannes@formbricks.com"
                        onSubmit={({ submission, schema, event }) => {
                          sendToHq({ submission, schema, event });
                          toast("Thanks a lot for your feedback");
                          setShow(false);
                        }}>
                        <Nps
                          name="nps"
                          label="How likely are you to recommend Formbricks to a friend or colleague?"
                        />
                        <Textarea name="feedback" label="Your feedback" cols={30} />
                        <Submit label="Submit" />
                      </Form>
                    </div>
                    <hr className="my-2" />
                    <p className="mt-1 text-sm text-gray-500">
                      If you have a specific issue, please contact support directly at email us or visit our
                      docs
                    </p>
                  </div>
                  <div className="ml-4 flex flex-shrink-0">
                    <button
                      type="button"
                      className="inline-flex rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      onClick={() => {
                        setShow(false);
                      }}>
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </>
  );
}
