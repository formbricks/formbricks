"use client";

import { BatteryFullIcon, SignalIcon, WifiIcon } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { PHONE_FRAME, PHONE_SCREEN, getPhoneScale } from "../../lib/phone-viewport";

/** The strip under the notch: the page starts below it, as in a phone browser. */
const StatusBar = () => (
  <div
    className="relative flex shrink-0 items-center justify-between bg-white px-8 text-slate-900"
    style={{ height: PHONE_SCREEN.statusBarHeight }}
    aria-hidden="true">
    <span className="text-[15px] font-semibold">9:41</span>
    <span className="absolute top-[11px] left-1/2 h-[34px] w-[124px] -translate-x-1/2 rounded-full bg-black" />
    <span className="flex items-center gap-1">
      <SignalIcon className="size-4" strokeWidth={2.5} />
      <WifiIcon className="size-4" strokeWidth={2.5} />
      <BatteryFullIcon className="size-5" strokeWidth={2} />
    </span>
  </div>
);

/**
 * A phone around the creative preview (ENG-4005 follow-up): its screen is a real phone's size in CSS px
 * (`PHONE_SCREEN`), and the whole device is scaled down to fit the pane rather than squeezed into it, so
 * the creative lays out as it would on a phone. `children` fill the page area below the status bar; a
 * preview boundary there keeps fixed creatives on the screen.
 */
export const PhoneViewport = ({ children }: Readonly<{ children: ReactNode }>) => {
  const areaRef = useRef<HTMLDivElement>(null);
  // Unknown until measured: the phone stays hidden rather than flash at the wrong size.
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const fit = () => setScale(getPhoneScale({ width: area.clientWidth, height: area.clientHeight }));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  const shown = scale ?? 0;

  return (
    <div className="h-full w-full overflow-hidden p-6">
      <div ref={areaRef} className="flex h-full w-full items-center justify-center">
        <div
          className={cn("shrink-0", scale === null && "invisible")}
          style={{ width: PHONE_FRAME.width * shown, height: PHONE_FRAME.height * shown }}>
          <div
            className="origin-top-left bg-slate-900 shadow-xl ring-1 ring-slate-950/20"
            style={{
              width: PHONE_FRAME.width,
              height: PHONE_FRAME.height,
              padding: PHONE_FRAME.bezel,
              borderRadius: PHONE_FRAME.cornerRadius,
              transform: `scale(${shown})`,
            }}>
            <div
              className="flex flex-col overflow-hidden bg-white"
              style={{
                width: PHONE_SCREEN.width,
                height: PHONE_SCREEN.height,
                borderRadius: PHONE_SCREEN.cornerRadius,
              }}>
              <StatusBar />
              <div className="min-h-0 flex-1">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
