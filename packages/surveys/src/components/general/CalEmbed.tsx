import snippet from "@calcom/embed-snippet";
import { useEffect, useMemo, useRef } from "preact/hooks";
import { TSurveyCalQuestion } from "@formbricks/types/surveys";
interface CalEmbedProps {
  question: TSurveyCalQuestion;
  value: string | number | string[];
  onSuccessfulBooking: (data: string) => void;
}

export enum BookingStatus {
  ACCEPTED = "Accepted",
}

export default function CalEmbed({ question, value, onSuccessfulBooking }: CalEmbedProps) {
  const calEmbedRef = useRef<HTMLDivElement>(null);

  const cal = useMemo(() => {
    const cal = snippet("https://cal.com/embed.js");
    const calCssVars = {
      "cal-border-subtle": "transparent",
      "cal-border-booker": "transparent",
    };

    cal("on", {
      action: "__iframeReady",
      callback: () => {
        const calEl = document.querySelector("cal-inline") as HTMLElement;
        if (calEl) {
          calEl.style.overflow = "auto";
        }
      },
    });
    cal("ui", {
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
    cal("on", {
      action: "bookingSuccessful",
      callback: (e) => {
        onSuccessfulBooking(JSON.stringify(e.detail.data));
      },
    });
    return cal;
  }, [onSuccessfulBooking]);

  useEffect(() => {
    document.querySelectorAll("cal-inline").forEach((el) => el.remove());
    cal("inline", { elementOrSelector: "#cal-embed", calLink: question.calUserName });
  }, [cal, question.calUserName]);

  return (
    <div className="relative mt-4">
      <div id="cal-embed" style={{ height: "42vh", display: "inline" }} ref={calEmbedRef} />
      <input
        name={question.id}
        id={question.id}
        required={question.required}
        pattern={Object.values(BookingStatus).join("|")}
        value={value}
        className="b-0 l-0 absolute h-[1px] w-full opacity-0"
        autocomplete="off"
      />
    </div>
  );
}
