"use client";

import { LockIcon, MonitorIcon, SmartphoneIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getTopLevelConditions } from "../../lib/show-conditions-ui";
import type { TCreative, TCreativeDevice } from "../../types";
import { CreativeRender } from "../creative-render";
import { Segmented } from "./editor-primitives";

const toHost = (siteName: string) =>
  `${siteName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "") || "yoursite"}.example`;

/** The first page-URL condition that names a path, so the preview sits on a page it would show on. */
const getPreviewPath = (creative: TCreative): string => {
  for (const condition of getTopLevelConditions(creative.targeting.showConditions)) {
    const value = condition.rightOperand?.value;
    if (condition.leftOperand.value === "currentUrl" && typeof value === "string" && value.startsWith("/")) {
      return value;
    }
  }
  return "/";
};

/** A neutral wireframe of a customer's site, so the creative is judged in context, not on a blank. */
const SiteWireframe = ({ siteName, compact }: Readonly<{ siteName: string; compact?: boolean }>) => (
  <div className="h-full bg-white" aria-hidden="true">
    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
      <div className="flex items-center gap-2">
        <span className="size-5 rounded-md bg-slate-800" />
        <span className="text-sm font-semibold text-slate-800">{siteName}</span>
      </div>
      {compact ? (
        <span className="h-3 w-5 rounded-sm border-y-2 border-slate-300" />
      ) : (
        <div className="flex gap-5">
          {[14, 18, 12, 10].map((width) => (
            <span key={width} className="h-2 rounded-full bg-slate-200" style={{ width: `${width * 4}px` }} />
          ))}
        </div>
      )}
    </div>
    <div className={cn("space-y-3 px-6", compact ? "py-8" : "py-14")}>
      <span className="block h-6 w-3/4 max-w-md rounded-md bg-slate-200" />
      <span className="block h-6 w-1/2 max-w-xs rounded-md bg-slate-200" />
      <span className="block h-2.5 w-2/3 max-w-sm rounded-full bg-slate-100" />
      <span className="mt-5 block h-9 w-32 rounded-md bg-slate-300" />
    </div>
    <div className={cn("grid gap-4 px-6", compact ? "grid-cols-1" : "grid-cols-3")}>
      {Array.from({ length: compact ? 2 : 3 }, (_, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-slate-100 p-4">
          <span className="block h-3 w-1/2 rounded-full bg-slate-200" />
          <span className="block h-2 w-full rounded-full bg-slate-100" />
          <span className="block h-2 w-2/3 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  </div>
);

export const CreativePreview = ({
  creative,
  siteName,
  device,
  onDeviceChange,
  linkedSurveyName,
}: Readonly<{
  creative: TCreative;
  siteName: string;
  device: TCreativeDevice;
  onDeviceChange: (device: TCreativeDevice) => void;
  /** The name of the survey picked on the Content tab, if any. */
  linkedSurveyName: string | null;
}>) => {
  const { t } = useTranslation();

  const activate = () => {
    if (creative.action.kind === "survey" && linkedSurveyName) {
      toast(t("workspace.creatives.editor.preview_opens_survey", { name: linkedSurveyName }));
    } else if (creative.action.kind === "link" && creative.action.url) {
      toast(t("workspace.creatives.editor.preview_opens_link", { url: creative.action.url }));
    } else {
      toast(t("workspace.creatives.editor.preview_no_action"));
    }
  };

  const render = <CreativeRender creative={creative} device={device} onActivate={activate} />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          {t("workspace.creatives.editor.live_preview")}
        </span>
        <Segmented
          ariaLabel={t("workspace.creatives.editor.preview_device")}
          value={device}
          onChange={onDeviceChange}
          options={[
            {
              value: "desktop",
              label: t("workspace.creatives.editor.desktop"),
              icon: MonitorIcon,
              hideLabel: true,
            },
            { value: "phone", label: t("common.phone"), icon: SmartphoneIcon, hideLabel: true },
          ]}
        />
      </div>

      {device === "desktop" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="size-2.5 rounded-full bg-slate-300" />
              <span className="size-2.5 rounded-full bg-slate-300" />
              <span className="size-2.5 rounded-full bg-slate-300" />
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-white px-3 py-1 text-xs text-slate-500 ring-1 ring-slate-200">
              <LockIcon className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                <span className="text-slate-700">{toHost(siteName)}</span>
                {getPreviewPath(creative)}
              </span>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <SiteWireframe siteName={siteName} />
            {render}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="relative h-[600px] max-h-full w-[300px] shrink-0 overflow-hidden rounded-[2.75rem] border-[10px] border-slate-900 bg-white shadow-xl">
            <div className="absolute top-2 left-1/2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
            <div className="relative h-full overflow-hidden pt-8">
              <SiteWireframe siteName={siteName} compact />
              {render}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
