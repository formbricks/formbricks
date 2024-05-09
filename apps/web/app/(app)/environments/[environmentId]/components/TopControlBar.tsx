import TopControlButtons from "@/app/(app)/environments/[environmentId]/components/TopControlButtons";
import { WidgetStatusIndicator } from "@/app/(app)/environments/[environmentId]/components/WidgetStatusIndicator";

import { TEnvironment } from "@formbricks/types/environment";

interface SideBarProps {
  environment: TEnvironment;
  environments: TEnvironment[];
}

export const TopControlBar = ({ environment, environments }: SideBarProps) => {
  return (
    <div className="flex h-14 w-full items-center justify-end px-6">
      <div className="shadow-xs z-10">
        <div className="flex w-fit space-x-2 py-2">
          <WidgetStatusIndicator environment={environment} type="mini" />
          <TopControlButtons environment={environment} environments={environments} />
        </div>
      </div>
    </div>
  );
};
