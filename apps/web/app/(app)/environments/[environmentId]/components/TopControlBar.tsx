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
    <div className="max-w-8xl z-50 flex h-12 w-full justify-end px-6">
      <div className="shadow-xs z-10">
        <div className="flex w-fit space-x-2 py-2">
          <WidgetStatusIndicator environment={environment} type="mini" />
          <TopControlButtons environment={environment} environments={environments} />
        </div>
      </div>
    </div>
  );
};
