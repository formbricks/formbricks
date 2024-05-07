"use client";

import TopControlButtons from "@/app/(app)/environments/[environmentId]/components/TopControlButtons";
import { WidgetStatusIndicator } from "@/app/(app)/environments/[environmentId]/components/WidgetStatusIndicator";
import { usePathname } from "next/navigation";

import { TEnvironment } from "@formbricks/types/environment";

interface SideBarProps {
  environment: TEnvironment;
  environments: TEnvironment[];
}

export const TopControlBar = ({ environment, environments }: SideBarProps) => {
  const pathname = usePathname();

  if (pathname?.includes("/edit") || pathname?.includes("/surveys/templates")) return null;

  return (
    <div className="max-w-8xl z-50 flex h-20 w-full justify-end px-6">
      <div className="shadow-xs z-10">
        {environment.type === "development" && (
          <div className="flex h-6 w-full items-center justify-center rounded-b-md bg-orange-800 p-0.5 text-center text-xs text-white">
            You&apos;re in an development environment. Set it up to test surveys, actions and attributes.
          </div>
        )}
        <div className="flex w-fit space-x-2 py-2">
          <WidgetStatusIndicator environment={environment} type="mini" />
          <TopControlButtons environment={environment} environments={environments} />
        </div>
      </div>
    </div>
  );
};
