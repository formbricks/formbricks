import snippet from "@calcom/embed-snippet";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import LoadingSpinner from "./LoadingSpinner";
import { TSurveyBookingQuestion } from "@formbricks/types/v1/surveys";

interface CalendarProps {
  question: TSurveyBookingQuestion;
  value: string | number | string[];
  brandColor: string;
  onSuccessfulBooking: (data: string) => void;
}

export enum BookingStatus {
  ACCEPTED = "Accepted",
}

export default function Calendar({ question, brandColor, value, onSuccessfulBooking }: CalendarProps) {
  const [loading, setLoading] = useState(true);
  const calEmbedRef = useRef<HTMLDivElement>(null);

  const cal = useMemo(() => {
    const cal = snippet("https://cal.com/embed.js");
    const calCssVars = {
      "cal-border-subtle": "transparent",
      "cal-border-booker": "transparent",
      "cal-brand": brandColor,
    };

    cal("on", {
      action: "__iframeReady",
      callback: () => {
        setLoading(false);
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
        // Currently we have no type support for embed events
        onSuccessfulBooking(JSON.stringify(e.detail.data));
      },
    });
    return cal;
  }, [brandColor, onSuccessfulBooking]);

  useEffect(() => {
    document.querySelectorAll("cal-inline").forEach((el) => el.remove());
    cal("inline", { elementOrSelector: "#cal-embed", calLink: question.calLink });
  }, [cal, question.calLink]);

  return (
    <div className="relative mt-4">
      {loading && <LoadingSpinner />}
      <div
        id="cal-embed"
        style={{ height: "42vh", display: loading ? "none" : "inline" }}
        ref={calEmbedRef}
      />
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
