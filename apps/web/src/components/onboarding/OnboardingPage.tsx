import { LogoMark } from "@/components/LogoMark";
import OnboardingSurvey from "@/components/onboarding/OnboardingSurvey";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useState } from "react";

export default function OnboardingPage() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setLoading(true);
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);
  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={() => {}}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0">
          <div className="fixed inset-0 bg-slate-200 bg-opacity-75 backdrop-blur transition-opacity" />
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
                <div className="bg-brand/10 border-brand mb-4 flex h-48 w-full flex-col items-center justify-center rounded-xl border py-5">
                  {loading ? (
                    <LogoMark />
                  ) : (
                    <span className="relative flex h-5 w-5 pt-1">
                      <span className="bg-brand/75 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
                      <span className="bg-brand relative inline-flex h-5 w-5 rounded-full"></span>
                    </span>
                  )}
                  {loading ? (
                    <>
                      <p className="text-brand pt-4 text-xs">Ready to roll 🤸</p>
                      <p className="text-brand pt-4 text-xs">
                        Please answer the following questions to continue
                      </p>
                    </>
                  ) : (
                    <p className="text-brand pt-4 text-xs">We&apos;re getting Formbricks ready for you.</p>
                  )}
                </div>
                <OnboardingSurvey />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
