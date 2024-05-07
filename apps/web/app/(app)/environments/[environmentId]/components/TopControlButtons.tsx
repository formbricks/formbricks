"use client";

import EnvironmentSwitch from "@/app/(app)/environments/[environmentId]/components/EnvironmentSwitch";
import { MessageCircleQuestionIcon, PlusIcon, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import formbricks from "@formbricks/js/app";
import { TEnvironment } from "@formbricks/types/environment";
import { Button } from "@formbricks/ui/Button";

interface TopControlsProps {
  environment: TEnvironment;
  environments: TEnvironment[];
}

export default function TopControls({ environment, environments }: TopControlsProps) {
  const router = useRouter();
  return (
    <div className="z-50 flex items-center space-x-2">
      <EnvironmentSwitch environment={environment} environments={environments} />

      <Button
        variant="minimal"
        size="icon"
        tooltip="Share feedback"
        className="h-fit w-fit  p-1"
        onClick={() => {
          formbricks.track("Top Menu: Product Feedback");
        }}>
        <MessageCircleQuestionIcon className="h-5 w-5" />
      </Button>
      <Button
        variant="minimal"
        size="icon"
        tooltip="Settings"
        className="h-fit w-fit p-1"
        onClick={() => {
          router.push(`/environments/${environment.id}/settings/profile`);
        }}>
        <SettingsIcon className="h-5 w-5" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        tooltip="Create survey"
        className="h-fit w-fit p-1"
        onClick={() => {
          router.push(`/environments/${environment.id}/surveys/templates`);
        }}>
        <PlusIcon className="h-5 w-5" />
      </Button>
    </div>
  );
}
