import { usePlausible } from "next-plausible";
import Script from "next/script";
import { useState } from "react";
import clsx from "clsx";

declare global {
  interface Window {
    formbricks: any;
  }
}

export default function FeedbackButton() {
  const plausible = usePlausible();
  const [scriptReady, setScriptReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/@formbricks/feedback@0.1.5/dist/index.umd.js"
        defer
        onReady={() => setScriptReady(true)}
      />
      <Script id="feedback-setup">{`
      window.formbricks = {
        ...window.formbricks,
        config: {
          hqUrl: "https://xm.formbricks.com",
          formId: "clchup08o0000lj08526vdujt",
          contact: {
            name: "Matti",
            position: "Co-Founder",
            imgUrl: "https://avatars.githubusercontent.com/u/675065?s=128&v=4",
          },
        },
    };`}</Script>
      {scriptReady && (
        <div
          className={clsx(
            "xs:right-0 xs:top-1/2 xs:w-[26rem] xs:-translate-y-1/2 fixed bottom-0 z-50 h-1/2 w-full transition-transform duration-500 ease-in-out",
            isOpen ? "xs:-translate-x-0 translate-y-0" : "xs:translate-x-[21.2rem] translate-y-[21.8rem]"
          )}>
          <div id="wrapper" className="xs:flex-row flex h-full flex-col">
            <button
              className="bg-brand xs:-rotate-90 xs:-mr-8 xs:my-auto z-40 mx-auto -mb-2 max-h-16 w-32 rounded p-4 font-medium text-white"
              onClick={(event) => {
                window.formbricks.open(event);
                plausible("openFeedback");
                setIsOpen(!isOpen);
              }}>
              {isOpen ? "Close" : "Feedback"}
            </button>
            <div className="bg-brand xs:rounded-l-lg xs:rounded-t-0 flex h-full w-full items-center justify-center">
              Feedback
            </div>
          </div>
        </div>
      )}
    </>
  );
}
