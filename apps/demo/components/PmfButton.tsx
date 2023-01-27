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
        formId: "cldbru2nu000s19t6mtc4bhk4",
        containerId: "formbricks",
        contact: {
          name: "Jonathan",
          position: "Co-Founder",
          imgUrl: "https://avatars.githubusercontent.com/u/41432658?v=4",
        },
        customer: {
          id: "test@crowd.dev",
          name: "Test Customer",
          email: "test@crowd.dev",
        },
        style: {
          brandColor: "#e94f2e",
          headerBGColor: "#F9FAFB",
          boxBGColor: "#ffffff",
          textColor: "#140505",
          buttonHoverColor: "#F9FAFB",
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
  // xs:translate-x-[21.2rem] translate-y-[21rem]
  return (
    <div
      className={clsx(
        "xs:flex-row xs:right-0 xs:top-1/2 xs:w-[24rem] xs:-translate-y-1/2 fixed bottom-0 z-50 h-fit w-full transition-all duration-500 ease-in-out",
        isOpen ? "xs:-translate-x-0 translate-y-0" : "xs:translate-x-full xs:-mr-1 translate-y-full"
      )}
      onClick={(e) => {
        e.stopPropagation();
      }}
      ref={feedbackRef}>
      <button
        className="xs:-rotate-90  xs:top-1/2 xs:-left-[5.8rem] xs:-translate-y-1/2 xs:-translate-x-0 xs:w-32 xs:p-4 absolute left-1/2 w-28 -translate-x-1/2 -translate-y-full rounded-t bg-cyan-600 p-3   font-medium text-white"
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
        className="xs:px-2 h-full overflow-hidden rounded-l-lg bg-[#f8fafc] shadow-lg"
        id="formbricks"></div>
    </div>
  );
}
