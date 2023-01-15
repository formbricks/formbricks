import clsx from "clsx";
import { useSession } from "next-auth/react";
import Script from "next/script";
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
  const [configLoaded, setConfigLoaded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const feedbackRef = useRef<HTMLInputElement>(null);
  const { data: session } = useSession();

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
    if (session && feedbackEnabled) {
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
          customer: session.user,
        },
      };
      setConfigLoaded(true);
    }
  }, [session]);

  if (!feedbackEnabled) return null;

  return (
    <>
      {configLoaded && (
        <Script src="https://cdn.jsdelivr.net/npm/@formbricks/feedback@0.1.9/dist/index.umd.js" defer />
      )}

      <div
        className={clsx(
          "xs:right-0 xs:top-1/2 xs:w-[26rem] xs:-translate-y-1/2 fixed bottom-0 z-50 h-96 w-full transition-transform duration-500 ease-in-out",
          isOpen ? "xs:-translate-x-0 translate-y-0" : "xs:translate-x-[21.3rem] translate-y-[21.5rem]"
        )}>
        <div
          className="xs:flex-row flex h-full flex-col"
          onClick={(e) => {
            e.stopPropagation();
          }}
          ref={feedbackRef}>
          <button
            className="bg-brand xs:-rotate-90 xs:-mr-8 xs:my-auto z-30 mx-auto -mb-1 max-h-16 w-32 rounded-t p-3 text-sm font-medium text-white"
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
            className="z-40 h-full w-full overflow-hidden rounded-l-lg bg-[#f8fafc] shadow-lg"
            id="formbricks-feedback-wrapper"></div>
        </div>
      </div>
    </>
  );
}
