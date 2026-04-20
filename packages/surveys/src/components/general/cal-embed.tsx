import snippet from "@calcom/embed-snippet";
import { useEffect, useMemo, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { type TSurveyCalElement } from "@formbricks/types/surveys/elements";
import { cn } from "@/lib/utils";

interface CalEmbedProps {
  element: TSurveyCalElement;
  onSuccessfulBooking: () => void;
}

export function CalEmbed({ element, onSuccessfulBooking }: CalEmbedProps) {
  const [error, setError] = useState(false);
  const { t } = useTranslation();

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
    cal("init", { calOrigin: element.calHost ? `https://${element.calHost}` : "https://cal.com" });
    cal("inline", {
      elementOrSelector: "#cal-embed",
      calLink: element.calUserName,
    });

    // Event-driven error detection via MutationObserver
    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (observer) observer.disconnect();
    };

    const embedContainer = document.getElementById("cal-embed");
    if (embedContainer) {
      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLIFrameElement) {
              node.addEventListener("load", () => {
                cleanup();
                setError(false);
              });
              node.addEventListener("error", () => {
                cleanup();
                setError(true);
              });
            }
          }
        }
      });

      observer.observe(embedContainer, { childList: true, subtree: true });

      // Fallback timeout in case no iframe appears at all
      timer = setTimeout(() => {
        const iframe = embedContainer.querySelector("iframe");
        if (!iframe) {
          cleanup();
          setError(true);
        }
      }, 5000);
    }

    return cleanup;
  }, [cal, element.calHost, element.calUserName]);

  if (error) {
    return (
      <div className="relative mt-4 overflow-auto">
        <div className="border-border rounded-input border p-4 text-center">
          <p className="text-sm text-red-600">{t("common.failed_to_load_booking_widget")}</p>
          <p className="text-muted-foreground mt-2 text-xs">
            {t("common.open_booking_page_directly_at")}{" "}
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
      <div id="cal-embed" className={cn("border-border rounded-input border")} />
    </div>
  );
}
