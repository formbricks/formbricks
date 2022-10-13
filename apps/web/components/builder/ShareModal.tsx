/* This example requires Tailwind CSS v2.0+ */
import { Dialog, Transition } from "@headlessui/react";
import { InformationCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import { Fragment } from "react";
import { useNoCodeForm } from "../../lib/noCodeForm";
import Loading from "../Loading";

export default function ShareModal({ open, setOpen, formId }) {
  const { noCodeForm, isLoadingNoCodeForm } = useNoCodeForm(formId);

  const getPublicFormUrl = () => {
    if (process.browser) {
      return `${window.location.protocol}//${window.location.host}/f/${formId}/`;
    }
  };

  if (isLoadingNoCodeForm) {
    return <Loading />;
  }

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
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6">
                <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    onClick={() => setOpen(false)}>
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                {!noCodeForm.published ? (
                  <div className="bg-ui-gray-light rounded-md border border-gray-700 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <InformationCircleIcon className="h-5 w-5 text-blue-400" aria-hidden="true" />
                      </div>
                      <div className="ml-3 flex-1 md:flex md:justify-between">
                        <p className="text-sm text-gray-700">
                          You haven&apos;t published this form yet. Please publish this form to share it with
                          others and get the first submissions.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Share your form</h3>
                    <div className="mt-2 max-w-xl text-sm text-gray-500">
                      <p>Let your participants fill out your form by accessing it via the public link.</p>
                    </div>
                    <div className="mt-5 sm:flex sm:items-center">
                      <div className="w-full sm:max-w-xs">
                        <label htmlFor="surveyLink" className="sr-only">
                          Public link
                        </label>
                        <input
                          id="surveyLink"
                          type="text"
                          placeholder="Enter your email"
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                          value={getPublicFormUrl()}
                          disabled
                        />
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(getPublicFormUrl());
                          toast("Link copied to clipboard 🙌");
                        }}
                        className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-transparent bg-gray-800 px-4 py-2 font-medium text-white shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
