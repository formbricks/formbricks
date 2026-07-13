import snippet from "@calcom/embed-snippet";
import { useEffect, useMemo } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { type TSurveyCalElement } from "@formbricks/types/surveys/elements";
import { cn } from "@/lib/utils";

interface CalEmbedProps {
  element: TSurveyCalElement;
  onSuccessfulBooking: () => void;
}

export function CalEmbed({ element, onSuccessfulBooking }: CalEmbedProps) {
  const { t } = useTranslation();
  const iframeTitle = t("common.scheduling_calendar");

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
    cal("init", { calOrigin: element.calHost ? `https://${element.calHost}` : "https://cal.com" });
    cal("inline", {
      elementOrSelector: "#cal-embed",
      calLink: element.calUserName,
    });

    // The snippet injects the iframe asynchronously without a title, so screen
    // readers announce it as just "iframe". Title it as soon as it appears.
    const embedContainer = document.querySelector("#cal-embed");
    if (!embedContainer) return;
    const titleIframe = (): boolean => {
      const iframe = embedContainer.querySelector("iframe");
      if (iframe && !iframe.title) iframe.title = iframeTitle;
      return Boolean(iframe);
    };
    if (!titleIframe()) {
      const observer = new MutationObserver(() => {
        if (titleIframe()) observer.disconnect();
      });
      observer.observe(embedContainer, { childList: true, subtree: true });
      return () => {
        observer.disconnect();
      };
    }
  }, [cal, element.calHost, element.calUserName, iframeTitle]);

  return (
    <div className="relative mt-4 overflow-auto">
      <div id="cal-embed" className={cn("border-border rounded-input border")} />
    </div>
  );
}
