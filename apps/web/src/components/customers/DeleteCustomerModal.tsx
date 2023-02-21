"use client";

import { deleteCustomer } from "@/lib/customers";
import { Button } from "@formbricks/ui";
import { Dialog, Transition } from "@headlessui/react";
import { TrashIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { toast } from "react-toastify";

type DeleteCustomerModalProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
  organisationId: string;
  customerId: string;
};

export default function DeleteCustomerModal({
  open,
  setOpen,
  organisationId,
  customerId,
}: DeleteCustomerModalProps) {
  const router = useRouter();

  const [deletingCustomer, setDeletingCustomer] = useState(false);

  const deleteCustomerAction = async (e) => {
    setDeletingCustomer(true);
    e.preventDefault();
    await deleteCustomer(customerId, organisationId);
    toast("User successfully deleted.");
    router.push(`/organisations/${organisationId}/customers`);
  };

  return (
    <>
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
            <div className="fixed inset-0 bg-slate-500 bg-opacity-30 backdrop-blur-md transition-opacity" />
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
                      className="rounded-md bg-white text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-0 focus:ring-offset-2"
                      onClick={() => setOpen(false)}>
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="p-2">
                    <h2 className="text-xl font-bold text-slate-800">All submission will be deleted</h2>
                    <p className="mt-4 text-slate-500">
                      Are you sure? All submissions of this customer will be deleted along with the customer.
                      <strong>This cannot be reversed.</strong>
                    </p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      variant="minimal"
                      onClick={() => setOpen(false)}
                      className="w-full justify-center">
                      Nevermind
                    </Button>
                    <Button
                      variant="warn"
                      loading={deletingCustomer}
                      onClick={(e) => deleteCustomerAction(e)}
                      className="w-full justify-center">
                      Delete
                      <TrashIcon className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  );
}
