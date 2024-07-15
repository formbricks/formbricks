import { TopControlButtons } from "@/app/(app)/environments/[environmentId]/components/TopControlButtons";
import { WidgetStatusIndicator } from "@/app/(app)/environments/[environmentId]/components/WidgetStatusIndicator";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { TEnvironment } from "@formbricks/types/environment";
import { TProductConfigChannel } from "@formbricks/types/product";

interface SideBarProps {
  environment: TEnvironment;
  environments: TEnvironment[];
  currentProductChannel: TProductConfigChannel;
}

export const TopControlBar = ({ environment, environments, currentProductChannel }: SideBarProps) => {
  return (
    <div className="fixed inset-0 top-0 z-30 flex h-14 w-full items-center justify-end bg-slate-50 px-6">
      <div className="shadow-xs z-10">
        <div className="flex w-fit items-center space-x-2 py-2">
          {currentProductChannel && currentProductChannel !== "link" && (
            <WidgetStatusIndicator environment={environment} size="mini" type={currentProductChannel} />
          )}
          {!currentProductChannel && (
            <>
              <WidgetStatusIndicator environment={environment} size="mini" type="website" />
              <WidgetStatusIndicator environment={environment} size="mini" type="app" />
            </>
          )}
          <TopControlButtons
            environment={environment}
            environments={environments}
            isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          />
        </div>
      </div>
    </div>
  );
};
