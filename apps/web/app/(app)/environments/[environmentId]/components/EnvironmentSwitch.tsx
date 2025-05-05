"use client";

import { cn } from "@/lib/cn";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";
import { useTranslate } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";

interface EnvironmentSwitchProps {
  environment: TEnvironment;
  environments: TEnvironment[];
}

export const EnvironmentSwitch = ({ environment, environments }: EnvironmentSwitchProps) => {
  const { t } = useTranslate();
  const router = useRouter();
  const [isEnvSwitchChecked, setIsEnvSwitchChecked] = useState(environment?.type === "development");
  const [isLoading, setIsLoading] = useState(false);

  const handleEnvironmentChange = (environmentType: "production" | "development") => {
    const newEnvironmentId = environments.find((e) => e.type === environmentType)?.id;
    if (newEnvironmentId) {
      router.push(`/environments/${newEnvironmentId}/`);
    }
  };

  const toggleEnvSwitch = () => {
    const newEnvironmentType = isEnvSwitchChecked ? "production" : "development";
    setIsLoading(true);
    setIsEnvSwitchChecked(!isEnvSwitchChecked);
    handleEnvironmentChange(newEnvironmentType);
  };

  return (
    <div
      className={cn(
        "flex items-center space-x-2 rounded-lg p-2",
        isEnvSwitchChecked ? "bg-slate-100 text-orange-800" : "hover:bg-slate-100"
      )}>
      <Label
        htmlFor="development-mode"
        className={cn("hover:cursor-pointer", isEnvSwitchChecked && "text-orange-800")}>
        {t("common.dev_env")}
      </Label>
      <Switch
        className="focus:ring-orange-800 data-[state=checked]:bg-orange-800"
        id="development-mode"
        disabled={isLoading}
        checked={isEnvSwitchChecked}
        onCheckedChange={toggleEnvSwitch}
      />
    </div>
  );
};
