import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    formbricks: any;
  }
}

export default function PmfButton() {
  const [isOpen, setIsOpen] = useState(false);
  const feedbackRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.formbricks = {
      ...window.formbricks,
      config: {
        formbricksUrl: "http://localhost:3000",
        formId: "clda6d0ot0000yzikvnnz07lm",
        containerId: "formbricks",
        style: {
          brandColor: "#0891b2",
        },
      },
    };
    require("@formbricks/pmf");
  }, []);

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
      <div
        className={clsx(
          "xs:right-0 xs:top-1/2 xs:w-[26rem] xs:-translate-y-1/2 xs:h-[30rem] fixed bottom-0 z-50 h-96 w-full transition-transform duration-500 ease-in-out",
          isOpen ? "xs:-translate-x-0 translate-y-0" : "xs:translate-x-[21.2rem] translate-y-[21rem]"
        )}>
        <div
          className="xs:flex-row flex h-full flex-col"
          onClick={(e) => {
            e.stopPropagation();
          }}
          ref={feedbackRef}>
          <button
            className="xs:-rotate-90 xs:-mr-7 xs:my-auto z-30 mx-auto -mb-2 max-h-16 w-32 rounded bg-cyan-600 p-4 font-medium text-white"
            onClick={() => {
              if (!isOpen) {
                if (window) {
                  window.formbricks.init();
                  window.formbricks.reset();
                }
              }
              setIsOpen(!isOpen);
            }}>
            {isOpen ? "Close" : "Feedback"}
          </button>
          <div
            className="z-40 h-full w-full overflow-hidden rounded-lg bg-[#f8fafc] shadow-lg"
            id="formbricks"></div>
        </div>
      </div>
    </>
  );
}
