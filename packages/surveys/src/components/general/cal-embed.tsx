import snippet from "@calcom/embed-snippet";
import { useEffect, useMemo, useRef } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { type TSurveyCalElement } from "@formbricks/types/surveys/elements";
import { cn } from "@/lib/utils";

interface CalEmbedProps {
  element: TSurveyCalElement;
  onSuccessfulBooking: () => void;
}

// Resolve a survey CSS custom property (e.g. `--fb-heading-color`) to a concrete
// color string, or `undefined` when the property isn't set on the scope.
//
// `getComputedStyle(probe).color` always returns *some* color — for an undefined
// var it falls back to the inherited `color`, which would silently override Cal's
// default theme. So we first confirm the custom property is actually declared,
// and only then resolve its (possibly `var(--slate-900)`-style) token to an rgb()
// via a throwaway probe. Cal.com's embed lives in a cross-origin iframe and can't
// read the parent's vars, so we forward the resolved colors into its own
// `cal-text-*` vars below.
function resolveSurveyColor(scope: HTMLElement, varName: string): string | undefined {
  if (!getComputedStyle(scope).getPropertyValue(varName).trim()) return undefined;
  const probe = document.createElement("span");
  probe.style.color = `var(${varName})`;
  probe.style.display = "none";
  scope.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color || undefined;
}

export function CalEmbed({ element, onSuccessfulBooking }: Readonly<CalEmbedProps>) {
  const { t } = useTranslation();
  const iframeTitle = t("common.scheduling_calendar");
  // Per-element id + Cal namespace so multiple Cal questions on one page don't
  // share a container, UI config, or the bookingSuccessful listener — a booking
  // in one scheduler must not fire another scheduler's callback.
  const containerId = `cal-embed-${element.id}`;
  const namespace = `cal-embed-${element.id}`;

  // Keep the latest booking callback in a ref so the Cal listener registered in
  // the effect below stays stable and doesn't churn (register/unregister) every
  // time `onSuccessfulBooking` changes identity.
  const onSuccessfulBookingRef = useRef(onSuccessfulBooking);
  onSuccessfulBookingRef.current = onSuccessfulBooking;

  const cal = useMemo(() => snippet("https://cal.com/embed.js"), []);

  useEffect(() => {
    // Initialize a namespaced Cal instance; `cal.ns[namespace]` is created
    // synchronously by the snippet so all further commands stay scoped to it.
    cal("init", namespace, {
      calOrigin: element.calHost ? `https://${element.calHost}` : "https://cal.com",
    });
    const ns = cal.ns[namespace];

    const embedContainer = document.getElementById(containerId);

    // Forward the survey's resolved text colors into Cal's own text vars so the
    // scheduler header (host, title, description, duration/link/timezone) stays
    // legible and honors the survey style override instead of Cal's washed-out
    // grey defaults. Unresolved vars fall back to Cal's default theme.
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

    ns("ui", {
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

    const handleBooking = (): void => {
      onSuccessfulBookingRef.current();
    };
    ns("on", { action: "bookingSuccessful", callback: handleBooking });

    ns("inline", {
      elementOrSelector: `#${containerId}`,
      calLink: element.calUserName,
    });

    // The snippet injects the iframe asynchronously without a title, so screen
    // readers announce it as just "iframe". Title it as soon as it appears.
    let observer: MutationObserver | undefined;
    if (embedContainer) {
      const titleIframe = (): boolean => {
        const iframe = embedContainer.querySelector("iframe");
        if (iframe && !iframe.title) iframe.title = iframeTitle;
        return Boolean(iframe);
      };
      if (!titleIframe()) {
        observer = new MutationObserver(() => {
          if (titleIframe()) observer?.disconnect();
        });
        observer.observe(embedContainer, { childList: true, subtree: true });
      }
    }

    return () => {
      ns("off", { action: "bookingSuccessful", callback: handleBooking });
      observer?.disconnect();
      // Remove only this scheduler's injected embed, not every cal-inline on the page.
      embedContainer?.querySelector("cal-inline")?.remove();
    };
  }, [cal, namespace, containerId, element.calHost, element.calUserName, iframeTitle]);

  return (
    <div className="relative mt-4 overflow-auto">
      <div id={containerId} className={cn("border-border rounded-input border")} />
    </div>
  );
}
