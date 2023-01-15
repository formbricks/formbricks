"use client";

import { createForm } from "@/lib/forms";
import { Button } from "@formbricks/ui";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { BsPlus } from "react-icons/bs";

type FormOnboardingModalProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
  workspaceId: string;
};

export default function NewFormModal({ open, setOpen, workspaceId }: FormOnboardingModalProps) {
  const router = useRouter();
  const [label, setLabel] = useState("");

  const createFormAction = async (e) => {
    e.preventDefault();
    const form = await createForm(workspaceId, {
      label,
      type: "feedback",
      schema: {
        type: "form",
        config: {},
        children: [
          {
            type: "radio",
            name: "feedbackType",
            label: "What's on your mind?",
            options: ["idea", "compliment", "bug"],
          },
          {
            type: "textarea",
            name: "message",
            label: "What's your feedback?",
          },
        ],
      },
    });
    router.push(`/workspaces/${workspaceId}/forms/${form.id}/feedback/`);
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
                  <h2 className="flex-none p-2 text-xl font-bold text-slate-800">Create new form</h2>
                </div>
                <form
                  onSubmit={(e) => createFormAction(e)}
                  className="inline-block w-full transform overflow-hidden p-2 text-left align-bottom transition-all sm:align-middle">
                  <div>
                    <label htmlFor="email" className="text-sm font-light text-slate-800">
                      Name your form
                    </label>
                    <div className="mt-2">
                      <input
                        type="text"
                        name="label"
                        className="focus:border-brand focus:ring-brand block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                        placeholder="e.g. Feedback Box App"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        autoFocus
                        required
                      />
                    </div>
                  </div>

                  <div className="mt-5 sm:mt-6">
                    <Button type="submit" className="w-full justify-center">
                      create feedback form
                      <BsPlus className="ml-1 h-6 w-6"></BsPlus>
                    </Button>
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
