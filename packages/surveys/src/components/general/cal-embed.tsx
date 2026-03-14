import snippet from "@calcom/embed-snippet";
import { useEffect, useMemo, useState } from "preact/hooks";
import { type TSurveyCalElement } from "@formbricks/types/surveys/elements";
import { cn } from "@/lib/utils";

interface CalEmbedProps {
  element: TSurveyCalElement;
  onSuccessfulBooking: () => void;
}

export function CalEmbed({ element, onSuccessfulBooking }: CalEmbedProps) {
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
    setError(false);
    setErrorMessage("");
    cal("init", { calOrigin: element.calHost ? `https://${element.calHost}` : "https://cal.com" });
    cal("inline", {
      elementOrSelector: "#cal-embed",
      calLink: element.calUserName,
    });

    // Set up error detection via MutationObserver for COEP/credentialless failures
    const timer = setTimeout(() => {
      const embedContainer = document.getElementById("cal-embed");
      if (embedContainer) {
        const iframe = embedContainer.querySelector("iframe");
        if (!iframe) {
          setError(true);
          setErrorMessage("Failed to load booking widget. Your environment may be blocking cross-origin resources.");
        }
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [cal, element.calHost, element.calUserName]);

  if (error) {
    return (
      <div className="relative mt-4 overflow-auto">
        <div className="border-border rounded-input border p-4 text-center">
          <p className="text-sm text-red-600">
            {errorMessage}
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            Try opening the booking page directly at{" "}
            <a
              href={`https://${element.calHost || "cal.com"}/${element.calUserName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline">
              {element.calHost || "cal.com"}/{element.calUserName}
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mt-4 overflow-auto">
      <div id="cal-embed" className={cn("border-border rounded-input border")}>
        {/* The cal.com widget renders here. If COEP/credentialless blocks the iframe,
            the timeout above will trigger an error state with a fallback link. */}
      </div>
    </div>
  );
}
