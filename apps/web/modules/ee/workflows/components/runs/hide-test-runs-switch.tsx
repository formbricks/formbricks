"use client";

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";

interface HideTestRunsSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** "Hide test runs" above a runs list (on by default): Test runs are for the author, not the log. */
export const HideTestRunsSwitch = ({ checked, onCheckedChange }: Readonly<HideTestRunsSwitchProps>) => {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="flex items-center justify-end gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor={id} className="text-sm font-normal text-slate-700">
        {t("workspace.workflows.hide_test_runs")}
      </Label>
    </div>
  );
};
