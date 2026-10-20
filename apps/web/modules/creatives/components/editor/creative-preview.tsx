"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { type TCreativeView, render } from "@formbricks/creatives";
import { cn } from "@/lib/cn";
import type { TStylingAppearance } from "@/lib/styling/dark-mode";
import {
  PreviewModeSwitches,
  PreviewWindowBar,
} from "@/modules/ui/components/preview-survey/components/preview-frame";
import { PREVIEW_BOUNDARY_CLASS_NAME } from "@/modules/ui/components/preview-survey/lib/containment";
import type { TCreativeDevice } from "../../lib/styling-form";
import { PhoneViewport } from "./phone-viewport";

/** A neutral wireframe of a customer's site, so the creative is judged in context, not on a blank. */
const SiteWireframe = ({ siteName, compact }: Readonly<{ siteName: string; compact: boolean }>) => (
  <div className="bg-white pb-24" aria-hidden="true">
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
      {Array.from({ length: compact ? 4 : 6 }, (_, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-slate-100 p-4">
          <span className="block h-3 w-1/2 rounded-full bg-slate-200" />
          <span className="block h-2 w-full rounded-full bg-slate-100" />
          <span className="block h-2 w-2/3 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  </div>
);

/** What a visitor's presses would do on a site; the editor says it instead of doing it. */
export interface TPreviewActions {
  /** A press on the feedback button or the banner's button: it opens the Destination. */
  onActivate: () => void;
  /** The banner's Dismiss. */
  onDismiss: () => void;
  /** A link in the banner's text. */
  onLinkPress: (href: string) => void;
}

/** The `href` of a link pressed inside the creative's shadow root, if the press was on one. */
const getPressedLink = (event: MouseEvent): string | null => {
  for (const target of event.composedPath()) {
    if (target instanceof HTMLAnchorElement && target.href) return target.getAttribute("href");
  }
  return null;
};

/**
 * Mounts the creative with `@formbricks/creatives`' own `render`, the code the SDK runs on a visitor's
 * page (ADR 0003), into a page box that stands in for the site. The box is a containing block for
 * fixed elements (`contain: layout paint`), so a feedback button or an Overlay banner sits at the
 * box's edges instead of the editor's; an In page banner goes into the page flow above the site.
 */
const CreativeMount = ({
  view,
  device,
  appearance,
  siteName,
  actions,
}: Readonly<{
  view: TCreativeView;
  device: TCreativeDevice;
  appearance: TStylingAppearance;
  siteName: string;
  actions: TPreviewActions;
}>) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const handlers = useRef(actions);
  useEffect(() => {
    handlers.current = actions;
  });

  // Keyed on the view's content: the editor builds a new view object on every render.
  const viewKey = JSON.stringify(view);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const host = render(JSON.parse(viewKey) as TCreativeView, {
      root,
      device,
      appearance,
      onClick: () => handlers.current.onActivate(),
      // The banner stays: the author is still styling it.
      onDismiss: () => handlers.current.onDismiss(),
    });
    return () => host.remove();
  }, [viewKey, device, appearance]);

  // A link in a banner's text would leave the editor; it says where it goes instead.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onClick = (event: MouseEvent) => {
      const href = getPressedLink(event);
      if (href === null) return;
      event.preventDefault();
      handlers.current.onLinkPress(href);
    };
    root.addEventListener("click", onClick, true);
    return () => root.removeEventListener("click", onClick, true);
  }, []);

  return (
    <div className={cn("h-full w-full bg-white", PREVIEW_BOUNDARY_CLASS_NAME)}>
      <div className="h-full overflow-y-auto">
        <div ref={rootRef} />
        <SiteWireframe siteName={siteName} compact={device === "phone"} />
      </div>
    </div>
  );
};

export const CreativePreview = ({
  view,
  siteName,
  device,
  onDeviceChange,
  appearance,
  onAppearanceChange,
  actions,
}: Readonly<{
  view: TCreativeView;
  siteName: string;
  device: TCreativeDevice;
  onDeviceChange: (device: TCreativeDevice) => void;
  appearance: TStylingAppearance;
  onAppearanceChange: (appearance: TStylingAppearance) => void;
  actions: TPreviewActions;
}>) => {
  const { t } = useTranslation();
  const mount = (
    <CreativeMount
      view={view}
      device={device}
      appearance={appearance}
      siteName={siteName}
      actions={actions}
    />
  );

  return (
    <div className="flex h-full w-full flex-col items-center p-2 py-4">
      <div className="relative flex h-[95%] w-full items-center justify-center overflow-hidden rounded-lg border border-slate-300">
        {device === "phone" ? (
          <>
            <p className="absolute top-0 left-0 m-2 rounded-sm bg-slate-100 px-2 py-1 text-xs text-slate-600">
              {t("common.preview")}
            </p>
            <PhoneViewport>{mount}</PhoneViewport>
          </>
        ) : (
          <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
            <PreviewWindowBar />
            <div className="min-h-0 flex-1">{mount}</div>
          </div>
        )}
      </div>
      <PreviewModeSwitches
        previewMode={device === "phone" ? "mobile" : "desktop"}
        onPreviewModeChange={(mode) => onDeviceChange(mode === "mobile" ? "phone" : "desktop")}
        appearance={appearance}
        onAppearanceChange={onAppearanceChange}
      />
    </div>
  );
};
