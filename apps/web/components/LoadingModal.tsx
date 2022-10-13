import { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { TailSpin } from "react-loader-spinner";

export default function LoadingModal({ isLoading }) {
  return (
    <Transition.Root show={isLoading} as={Fragment}>
      <Dialog
        as="div"
        static
        className="fixed inset-0 z-10 overflow-y-auto"
        open={isLoading}
        onClose={() => {}}>
        <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0">
            <Dialog.Overlay className="fixed inset-0 bg-gray-500 bg-opacity-20 transition-opacity" />
          </Transition.Child>

          {/* This element is to trick the browser into centering the modal contents. */}
          <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
            &#8203;
          </span>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
            <div className="inline-flex transform items-center justify-center overflow-hidden rounded-lg px-4 py-20 pb-4 text-left align-bottom transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6 sm:align-middle">
              <TailSpin color="#000" height={50} width={50} />
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
