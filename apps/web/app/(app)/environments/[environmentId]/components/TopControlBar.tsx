"use client";

import TopControlButtons from "@/app/(app)/environments/[environmentId]/components/TopControlButtons";
import { WidgetStatusIndicator } from "@/app/(app)/environments/[environmentId]/components/WidgetStatusIndicator";
import { usePathname } from "next/navigation";

import { TEnvironment } from "@formbricks/types/environment";

interface SideBarProps {
  environment: TEnvironment;
  environments: TEnvironment[];
}

export default function SideBar({ environment, environments }: SideBarProps) {
  const pathname = usePathname();

  if (pathname?.includes("/edit") || pathname?.includes("/surveys/templates")) return null;

  return (
    <div className="max-w-8xl z-50 flex w-full justify-end px-6">
      <div className="shadow-xs fixed z-10 rounded-b-xl border border-slate-200 bg-white">
        <div className="flex w-fit space-x-2 p-2">
          <WidgetStatusIndicator environment={environment} type="mini" />
          <TopControlButtons environment={environment} environments={environments} />
        </div>
        {environment.type === "development" && (
          <div className="flex h-6 w-full items-center justify-center rounded-b-xl bg-orange-800 p-0.5 text-center text-xs text-white">
            You&apos;re in an development environment. Set it up to test surveys, actions and attributes.
          </div>
        )}
      </div>
    </div>
  );
}
