import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    formbricks: any;
  }
}

const feedbackEnabled = !!(
  process.env.NEXT_PUBLIC_FORMBRICKS_URL && process.env.NEXT_PUBLIC_FORMBRICKS_FORM_ID
);

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const feedbackRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (feedbackEnabled) {
      // Bind the event listener
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        // Unbind the event listener on clean up
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }

    // Close the feedback form if the user clicks outside of it
    function handleClickOutside(event: any) {
      if (feedbackRef.current && !feedbackRef.current.contains(event.target)) {
        if (isOpen) setIsOpen(false);
      }
    }
  }, [feedbackRef, isOpen]);

  useEffect(() => {
    window.formbricks = {
      ...window.formbricks,
      config: {
        hqUrl: process.env.NEXT_PUBLIC_FORMBRICKS_URL,
        formId: process.env.NEXT_PUBLIC_FORMBRICKS_FORM_ID,
        divId: "formbricks-feedback-wrapper",
        contact: {
          name: "Matti",
          position: "Co-Founder",
          imgUrl: "https://avatars.githubusercontent.com/u/675065?s=128&v=4",
        },
      },
    };
    // @ts-ignore
    import("@formbricks/feedback");
  }, []);

  if (!feedbackEnabled) return null;

  return (
    <>
      <div
        className={clsx(
          "xs:flex-row xs:right-0 xs:top-1/2 xs:w-[18rem] xs:-translate-y-1/2 fixed bottom-0 z-50 h-[22rem] w-full transition-all duration-500 ease-in-out",
          isOpen ? "xs:-translate-x-0 translate-y-0" : "xs:translate-x-full xs:-mr-1 translate-y-full"
        )}>
        <div
          className="xs:flex-row flex h-full flex-col"
          onClick={(e) => {
            e.stopPropagation();
          }}
          ref={feedbackRef}>
          <button
            className="xs:-rotate-90  xs:top-1/2 xs:-left-[5.75rem] xs:-translate-y-1/2 xs:-translate-x-0 xs:w-32 xs:p-4 bg-brand-dark absolute left-1/2 w-28 -translate-x-1/2 -translate-y-full rounded-t-lg p-3 font-medium text-white"
            onClick={() => {
              if (!isOpen) {
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
            className="xs:rounded-bl-lg xs:rounded-tr-none h-full h-full w-full overflow-hidden rounded-bl-none rounded-tr-lg rounded-tl-lg  bg-slate-50 shadow-lg"
            id="formbricks-feedback-wrapper"></div>
        </div>
      </div>
    </>
  );
}
