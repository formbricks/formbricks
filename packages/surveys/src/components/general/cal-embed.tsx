import snippet from "@calcom/embed-snippet";
import { useEffect, useMemo } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { type TSurveyCalElement } from "@formbricks/types/surveys/elements";
import { cn } from "@/lib/utils";

interface CalEmbedProps {
  element: TSurveyCalElement;
  onSuccessfulBooking: () => void;
}

// Resolve a survey CSS custom property (e.g. `--fb-heading-color`) to a concrete
// color string. The survey style vars can hold `var(--slate-900)`-style tokens,
// so we let the browser compute the final value via a throwaway probe element.
// Cal.com's embed lives in an iframe and can't read the parent's vars, so we
// forward the resolved colors into its own `cal-text-*` vars below.
function resolveSurveyColor(scope: HTMLElement, varName: string): string | undefined {
  const probe = document.createElement("span");
  probe.style.color = `var(${varName})`;
  probe.style.display = "none";
  scope.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color || undefined;
}

export function CalEmbed({ element, onSuccessfulBooking }: CalEmbedProps) {
  const { t } = useTranslation();
  const iframeTitle = t("common.scheduling_calendar");
  // Per-element id so multiple Cal questions on one page don't all inject into the
  // first container (and so the iframe-title lookup below targets the right one).
  const containerId = `cal-embed-${element.id}`;

  const cal = useMemo(() => {
    const calInline = snippet("https://cal.com/embed.js");

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

    const embedContainer = document.getElementById(containerId);

    // Forward the survey's resolved text colors into Cal's own text vars so the
    // scheduler header (host, title, description, duration/link/timezone) stays
    // legible and honors the survey style override instead of Cal's washed-out
    // grey defaults. Fall back to Cal's theme when a var can't be resolved.
    const headingColor = embedContainer
      ? resolveSurveyColor(embedContainer, "--fb-heading-color")
      : undefined;
    const subheadingColor = embedContainer
      ? resolveSurveyColor(embedContainer, "--fb-subheading-color")
      : undefined;
    const infoColor = embedContainer ? resolveSurveyColor(embedContainer, "--fb-info-text-color") : undefined;

    const calTextVars = {
      ...(headingColor ? { "cal-text-emphasis": headingColor } : {}),
      ...(subheadingColor ? { "cal-text": subheadingColor, "cal-text-subtle": subheadingColor } : {}),
      ...(infoColor ? { "cal-text-muted": infoColor } : {}),
    };

    const calCssVars = {
      "cal-border-subtle": "transparent",
      "cal-border-booker": "transparent",
      ...calTextVars,
    };

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

    cal("init", { calOrigin: element.calHost ? `https://${element.calHost}` : "https://cal.com" });
    cal("inline", {
      elementOrSelector: `#${containerId}`,
      calLink: element.calUserName,
    });

    // The snippet injects the iframe asynchronously without a title, so screen
    // readers announce it as just "iframe". Title it as soon as it appears.
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
  }, [cal, element.calHost, element.calUserName, iframeTitle, containerId]);

  return (
    <div className="relative mt-4 overflow-auto">
      <div id={containerId} className={cn("border-border rounded-input border")} />
    </div>
  );
}
