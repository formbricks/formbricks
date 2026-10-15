"use client";

import { EyeIcon, UsersIcon } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { NumberStepper } from "@/modules/ui/components/number-stepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";
import { MOCK_ACTIONS } from "../../mock/data";
import type { TCreative, TCreativeTargeting } from "../../types";
import { EditorField, EditorPanel, Segmented } from "./editor-primitives";
import { ShowConditionsCard } from "./show-conditions-card";

const DEFAULT_SHARE = 50;

export const SettingsTab = ({
  creative,
  onChange,
  showErrors,
}: Readonly<{ creative: TCreative; onChange: (creative: TCreative) => void; showErrors: boolean }>) => {
  const { t } = useTranslation();
  const ids = useId();
  const { targeting } = creative;
  const setTargeting = (patch: Partial<TCreativeTargeting>) =>
    onChange({ ...creative, targeting: { ...targeting, ...patch } });

  return (
    <>
      <EditorPanel title={t("workspace.creatives.editor.show_on")} icon={EyeIcon}>
        <Segmented
          fill
          ariaLabel={t("workspace.creatives.editor.show_on")}
          value={targeting.trigger}
          onChange={(trigger) =>
            setTargeting({ trigger, actionName: trigger === "action" ? targeting.actionName : null })
          }
          options={[
            { value: "page_view", label: t("workspace.creatives.editor.every_page_view") },
            { value: "action", label: t("workspace.creatives.editor.when_action_fires") },
          ]}
        />
        {targeting.trigger === "action" && (
          <EditorField label={t("common.action")} htmlFor={`${ids}-action`}>
            <Select
              value={targeting.actionName ?? undefined}
              onValueChange={(actionName) => setTargeting({ actionName })}>
              <SelectTrigger id={`${ids}-action`}>
                <SelectValue placeholder={t("workspace.creatives.editor.choose_action")} />
              </SelectTrigger>
              <SelectContent>
                {MOCK_ACTIONS.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditorField>
        )}
      </EditorPanel>

      <ShowConditionsCard
        value={targeting.showConditions}
        onChange={(showConditions) => setTargeting({ showConditions })}
        showErrors={showErrors}
      />

      <EditorPanel title={t("workspace.creatives.editor.audience")} icon={UsersIcon}>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor={`${ids}-share-toggle`} className="space-y-0.5">
            <span className="block text-sm font-medium text-slate-900">
              {t("workspace.creatives.editor.share_of_visitors")}
            </span>
            <span className="block text-xs text-slate-500">
              {t("workspace.creatives.editor.decided_once_per_visitor")}
            </span>
          </label>
          <Switch
            id={`${ids}-share-toggle`}
            checked={targeting.sharePercent !== null}
            onCheckedChange={(checked) => setTargeting({ sharePercent: checked ? DEFAULT_SHARE : null })}
          />
        </div>
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm",
            targeting.sharePercent === null && "text-slate-500"
          )}>
          {targeting.sharePercent === null ? (
            <>
              <UsersIcon className="size-4" aria-hidden="true" />
              {t("workspace.creatives.editor.everyone_who_matches")}
            </>
          ) : (
            <>
              <NumberStepper
                className="w-36 bg-white"
                aria-label={t("workspace.creatives.editor.share_of_visitors")}
                value={targeting.sharePercent}
                onChange={(sharePercent) => setTargeting({ sharePercent })}
                min={1}
                max={100}
                step={5}
                unit="%"
              />
              <span className="text-slate-600">{t("workspace.creatives.editor.of_visitors")}</span>
            </>
          )}
        </div>
      </EditorPanel>
    </>
  );
};
