import clsx from "clsx";
import { usePlausible } from "next-plausible";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    formbricks: any;
  }
}

export default function FeedbackButton() {
  const plausible = usePlausible();
  const [isOpen, setIsOpen] = useState(false);
  const feedbackRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Close the feedback form if the user clicks outside of it
    function handleClickOutside(event: any) {
      if (feedbackRef.current && !feedbackRef.current.contains(event.target)) {
        if (isOpen) setIsOpen(false);
      }
    }
    // Bind the event listener
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [feedbackRef, isOpen]);

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/@formbricks/feedback@0.1.9/dist/index.umd.js" defer />

      <Script id="feedback-setup">{`
      window.formbricks = {
        ...window.formbricks,
        config: {
          hqUrl: "https://xm.formbricks.com",
          formId: "clcrjztwl0000mi08e26rzjkg",
          divId: "formbricks-feedback-wrapper",
          contact: {
            name: "Matti",
            position: "Co-Founder",
            imgUrl: "https://avatars.githubusercontent.com/u/675065?s=128&v=4",
          },
        },
    };`}</Script>
      <div
        className={clsx(
          "xs:right-0 xs:top-1/2 xs:w-[26rem] xs:-translate-y-1/2 xs:h-[22rem] fixed bottom-0 z-50 h-96 w-full transition-transform duration-500 ease-in-out",
          isOpen ? "xs:-translate-x-0 translate-y-0" : "xs:translate-x-[21.2rem] translate-y-[21rem]"
        )}>
        <div
          className="xs:flex-row flex h-full flex-col"
          onClick={(e) => {
            e.stopPropagation();
          }}
          ref={feedbackRef}>
          <button
            className="bg-brand-dark xs:-rotate-90 xs:-mr-7 xs:my-auto z-30 mx-auto -mb-2 max-h-16 w-32 rounded p-4 font-medium text-white"
            onClick={() => {
              if (!isOpen) {
                plausible("openFeedback");
                if (window) {
                  window.formbricks.render();
                  window.formbricks.resetForm();
                }
              }
              setIsOpen(!isOpen);
            }}>
            {isOpen ? "Close" : "Feedback"}
          </button>
          <div
            className="z-40 h-full w-full overflow-hidden rounded-lg bg-[#f8fafc] shadow-lg"
            id="formbricks-feedback-wrapper"></div>
        </div>
      </div>
    </>
  );
}
