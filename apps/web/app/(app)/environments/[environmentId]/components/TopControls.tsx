import WidgetStatusIndicator from "@/app/(app)/environments/[environmentId]/components/WidgetStatusIndicator";
import { MessageCircleQuestionIcon, PlusIcon, SettingsIcon } from "lucide-react";

import { TEnvironment } from "@formbricks/types/environment";
import { Button } from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";

interface TopControlsProps {
  environment: TEnvironment;
}

export default function TopControls({ environment }: TopControlsProps) {
  return (
    <div className="flex items-center space-x-2 pr-10">
      <WidgetStatusIndicator environmentId={environment.id} type="mini" />
      <div className="flex items-center space-x-2 rounded-md p-2 hover:bg-slate-100">
        <Label htmlFor="development-mode" className="hover:cursor-pointer">
          Test mode
        </Label>
        <Switch className="focus:ring-orange-800 data-[state=checked]:bg-orange-800" id="development-mode" />
      </div>

      <Button variant="minimal" size="icon" tooltip="Share feedback" className="h-fit w-fit  p-1">
        <MessageCircleQuestionIcon className="h-5 w-5" />
      </Button>
      <Button variant="minimal" size="icon" tooltip="Settings" className="h-fit w-fit  p-1">
        <SettingsIcon className="h-5 w-5" />
      </Button>
      <Button variant="secondary" size="icon" tooltip="Create survey" className="h-fit w-fit p-1">
        <PlusIcon className="h-5 w-5" />
      </Button>
    </div>
  );
}
