"use client";

import { XIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { TCreative, TCreativeDevice } from "../types";
import { CREATIVE_CONTENT_ICONS } from "./creative-icons";

// A stand-in for the SDK renderer, close enough to judge size, position and copy in the editor.
// The real preview will mount the same Shadow DOM renderer the site loads (T3), not this.

/** Stand-in for the workspace survey font; "inherit" takes whatever the page around it uses. */
const SURVEY_FONT = "ui-rounded, 'Inter', system-ui, sans-serif";

export const CreativeRender = ({
  creative,
  device,
  onActivate,
}: Readonly<{ creative: TCreative; device: TCreativeDevice; onActivate: () => void }>) => {
  const { t } = useTranslation();
  const { styling } = creative;
  const layout = creative.layout[device];
  const label = creative.content.label || t("workspace.creatives.editor.label_placeholder");
  const look: CSSProperties = {
    background: styling.backgroundColor,
    color: styling.textColor,
    fontFamily: styling.font === "survey" ? SURVEY_FONT : "inherit",
    fontWeight: styling.fontWeight,
    fontSize: layout.fontSize,
  };

  if (creative.type === "banner") {
    return (
      <div
        className="absolute inset-x-0 z-10 flex items-center justify-center gap-3 shadow-lg"
        style={{
          ...look,
          [layout.bannerPosition]: 0,
          [layout.bannerPosition === "top" ? "borderBottom" : "borderTop"]:
            `1px solid ${styling.borderColor}`,
          padding: `${layout.paddingY}px ${layout.paddingX}px`,
        }}>
        <p className="min-w-0 truncate">
          {creative.content.message || t("workspace.creatives.editor.message_placeholder")}
        </p>
        {creative.content.label && (
          <button
            type="button"
            onClick={onActivate}
            className="shrink-0 rounded-md px-3 py-1"
            style={{ background: styling.textColor, color: styling.backgroundColor, fontSize: "0.9em" }}>
            {creative.content.label}
          </button>
        )}
        {creative.content.dismissible && (
          <XIcon className="absolute right-3 size-4 opacity-70" aria-hidden="true" />
        )}
      </div>
    );
  }

  const Icon = creative.content.icon ? CREATIVE_CONTENT_ICONS[creative.content.icon] : null;
  const isVertical = layout.edge !== "bottom";
  const radius = `${styling.radius}px`;
  const placement: Record<typeof layout.edge, CSSProperties> = {
    right: {
      right: 0,
      top: `${layout.offset}%`,
      transform: "translateY(-50%)",
      borderTopLeftRadius: radius,
      borderBottomLeftRadius: radius,
    },
    left: {
      left: 0,
      top: `${layout.offset}%`,
      transform: "translateY(-50%) rotate(180deg)",
      borderTopLeftRadius: radius,
      borderBottomLeftRadius: radius,
    },
    bottom: {
      bottom: 0,
      left: `${layout.offset}%`,
      transform: "translateX(-50%)",
      borderTopLeftRadius: radius,
      borderTopRightRadius: radius,
    },
  };

  return (
    <button
      type="button"
      onClick={onActivate}
      className="absolute z-10 flex items-center gap-2 whitespace-nowrap shadow-lg transition-[top,left] duration-200"
      style={{
        ...look,
        ...placement[layout.edge],
        border: `1px solid ${styling.borderColor}`,
        // Vertical tabs run along the edge, so the X/Y paddings swap with the text direction.
        padding: isVertical
          ? `${layout.paddingX}px ${layout.paddingY}px`
          : `${layout.paddingY}px ${layout.paddingX}px`,
        writingMode: isVertical ? "vertical-rl" : undefined,
      }}>
      {Icon && (
        <Icon className="size-[1.1em] shrink-0" style={isVertical ? { rotate: "90deg" } : undefined} />
      )}
      {label}
    </button>
  );
};
