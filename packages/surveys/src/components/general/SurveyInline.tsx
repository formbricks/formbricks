import { useEffect, useState } from "preact/hooks";

import { SurveyInlineProps } from "@formbricks/types/formbricksSurveys";

import { Survey } from "./Survey";

export const SurveyInline = (props: SurveyInlineProps) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768); // Assuming 768px as a breakpoint for mobile

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div id="fbjs" className="formbricks-form h-full w-full">
      {isMobile ? (
        <div className="flex h-screen w-full flex-col justify-end overflow-hidden">
          <div>
            <Survey {...props} />
          </div>
        </div>
      ) : (
        <Survey {...props} />
      )}
    </div>
  );
};
