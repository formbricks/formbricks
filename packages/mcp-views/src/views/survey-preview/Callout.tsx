import type { ReactNode } from "react";

type CalloutTone = "neutral" | "warning" | "danger";

const TONE_CLASS: Record<CalloutTone, string> = {
  neutral: "fb-notice",
  warning: "fb-notice fb-notice-warning",
  danger: "fb-notice fb-notice-danger",
};

/** Same look as the shared `Notice`, with the tone class separated from the base class by a space. */
export const Callout = ({
  tone = "neutral",
  children,
}: Readonly<{ tone?: CalloutTone; children: ReactNode }>) => (
  <div className={TONE_CLASS[tone]} role={tone === "neutral" ? "status" : "alert"}>
    {children}
  </div>
);
