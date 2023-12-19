import { cn } from "@/lib/utils";
import snippet from "@calcom/embed-snippet";
import { useEffect, useMemo } from "preact/hooks";

import { TSurveyCalQuestion } from "@formbricks/types/surveys";

interface CalEmbedProps {
  question: TSurveyCalQuestion;
  onSuccessfulBooking: () => void;
}

export default function CalEmbed({ question, onSuccessfulBooking }: CalEmbedProps) {
  const cal = useMemo(() => {
    const calInline = snippet("https://cal.com/embed.js");

    const calCssVars = {
      "cal-border-subtle": "transparent",
      "cal-border-booker": "transparent",
    };

    calInline("ui", {
      theme: "light",
      cssVarsPerTheme: {
        light: {
          ...calCssVars,
        },
        dark: {
          "cal-bg-muted": "transparent",
          "cal-bg": "transparent",
          ...calCssVars,
        },
      },
    });

    calInline("on", {
      action: "bookingSuccessful",
      callback: () => {
        onSuccessfulBooking();
      },
    });

    return calInline;
  }, [onSuccessfulBooking]);

  useEffect(() => {
    // remove any existing cal-inline elements
    document.querySelectorAll("cal-inline").forEach((el) => el.remove());
    cal("inline", { elementOrSelector: "#fb-cal-embed", calLink: question.calUserName });
  }, [cal, question.calUserName]);

  return (
    <div className="relative mt-4">
      <div id="fb-cal-embed" className={cn("h-96 overflow-auto rounded-lg border border-slate-200")} />
    </div>
  );
}
