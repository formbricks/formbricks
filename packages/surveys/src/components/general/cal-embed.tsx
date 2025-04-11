import snippet from "@calcom/embed-snippet";
import { useEffect, useMemo } from "react";
import { type TSurveyCalQuestion } from "@formbricks/types/surveys/types";
import { cn } from "../../lib/utils";

interface CalEmbedProps {
  question: TSurveyCalQuestion;
  onSuccessfulBooking: () => void;
}

export function CalEmbed({ question, onSuccessfulBooking }: CalEmbedProps) {
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
    document.querySelectorAll("cal-inline").forEach((el) => {
      el.remove();
    });
    cal("init", { calOrigin: question.calHost ? `https://${question.calHost}` : "https://cal.com" });
    cal("inline", {
      elementOrSelector: "#cal-embed",
      calLink: question.calUserName,
    });
  }, [cal, question.calHost, question.calUserName]);

  return (
    <div className="relative mt-4 overflow-auto">
      <div id="cal-embed" className={cn("border-border rounded-lg border")} />
    </div>
  );
}
