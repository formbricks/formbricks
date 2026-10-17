"use client";

import { MonitorIcon, SmartphoneIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { type TStylingAppearance } from "@/lib/styling/dark-mode";
import { PreviewAppearanceSwitch } from "@/modules/ui/components/styling-appearance";
import { TabOption } from "./tab-option";

/**
 * The pieces of the survey preview's frame that other previews extend (the creative editor's, ENG-4005):
 * the browser window bar above the desktop frame, and the device and appearance switches below it.
 */

export type TPreviewMode = "mobile" | "desktop";

interface PreviewWindowBarProps {
  title: string;
  /** Makes the green dot the expand / shrink button, as in the survey editor. */
  expand?: { isExpanded: boolean; onToggle: () => void; label: string };
  /** Controls on the right, such as the language selector. */
  children?: ReactNode;
}

export const PreviewWindowBar = ({ title, expand, children }: Readonly<PreviewWindowBarProps>) => (
  <div className="flex h-8 w-full items-center rounded-t-lg bg-slate-100">
    <div className="ml-6 flex gap-x-2">
      <div className="size-3 rounded-full bg-red-500"></div>
      <div className="size-3 rounded-full bg-amber-500"></div>
      {expand ? (
        <button
          type="button"
          className="size-3 cursor-pointer rounded-full bg-emerald-500"
          onClick={expand.onToggle}
          aria-label={expand.label}></button>
      ) : (
        <div className="size-3 rounded-full bg-emerald-500"></div>
      )}
    </div>
    <div className="ml-4 flex w-full justify-between font-mono text-sm text-slate-400">
      <p className="text-slate-600">{title}</p>
      <div className="flex items-center">{children}</div>
    </div>
  </div>
);

interface PreviewModeSwitchesProps {
  /** The frame on screen; `null` highlights neither (the survey preview's reset). */
  previewMode: TPreviewMode | null;
  onPreviewModeChange: (mode: TPreviewMode) => void;
  appearance?: TStylingAppearance;
  /** Shows the sun / moon switch next to the device toggle when set. */
  onAppearanceChange?: (appearance: TStylingAppearance) => void;
}

export const PreviewModeSwitches = ({
  previewMode,
  onPreviewModeChange,
  appearance = "light",
  onAppearanceChange,
}: Readonly<PreviewModeSwitchesProps>) => {
  const { t } = useTranslation();

  return (
    <div className="mt-2 flex items-center justify-center gap-2">
      <div className="flex rounded-full border-2 border-slate-300 p-1">
        <TabOption
          active={previewMode === "mobile"}
          icon={<SmartphoneIcon className="mx-4 my-2 size-4 text-slate-700" />}
          label={t("workspace.surveys.edit.mobile_preview")}
          onClick={() => onPreviewModeChange("mobile")}
        />
        <TabOption
          active={previewMode === "desktop"}
          icon={<MonitorIcon className="mx-4 my-2 size-4 text-slate-700" />}
          label={t("workspace.surveys.edit.desktop_preview")}
          onClick={() => onPreviewModeChange("desktop")}
        />
      </div>
      {onAppearanceChange && (
        <PreviewAppearanceSwitch
          appearance={appearance}
          onChange={onAppearanceChange}
          optionClassName="px-4 py-2"
        />
      )}
    </div>
  );
};
