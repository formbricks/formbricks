"use client";

import { EyeIcon, UsersIcon, XIcon, ZapIcon } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { NumberStepper } from "@/modules/ui/components/number-stepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";
import type { TCreativeDistributionForm } from "../../lib/editor-form";
import { EditorField, EditorPanel, Segmented } from "./editor-primitives";
import { ShowConditionsCard } from "./show-conditions-card";

const DEFAULT_SHARE = 50;

/** An action the creative can show on: one of the workspace's action classes. */
export interface TCreativeActionOption {
  id: string;
  name: string;
}

const ActionPicker = ({
  actionClassIds,
  onChange,
  actionOptions,
  isInvalid,
}: Readonly<{
  actionClassIds: string[];
  onChange: (actionClassIds: string[]) => void;
  actionOptions: TCreativeActionOption[];
  isInvalid: boolean;
}>) => {
  const { t } = useTranslation();
  const ids = useId();
  const names = new Map(actionOptions.map(({ id, name }) => [id, name]));
  const available = actionOptions.filter(({ id }) => !actionClassIds.includes(id));

  if (actionOptions.length === 0) {
    return <p className="text-sm text-slate-500">{t("common.no_actions_found")}</p>;
  }

  return (
    <div className="space-y-2">
      {actionClassIds.length > 0 && (
        <ul className="space-y-1.5">
          {actionClassIds.map((actionClassId) => (
            <li
              key={actionClassId}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 py-1 pr-1 pl-3 text-sm text-slate-800">
              <ZapIcon className="size-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{names.get(actionClassId) ?? actionClassId}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-slate-500"
                aria-label={t("workspace.creatives.editor.remove_action")}
                onClick={() => onChange(actionClassIds.filter((id) => id !== actionClassId))}>
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {available.length > 0 && (
        <EditorField
          label={actionClassIds.length > 0 ? t("common.add_action") : t("common.action")}
          htmlFor={`${ids}-action`}>
          {/* Keyed on the picks so the trigger goes back to its placeholder after each one. */}
          <Select
            key={actionClassIds.join()}
            onValueChange={(actionClassId) => onChange([...actionClassIds, actionClassId])}>
            <SelectTrigger
              id={`${ids}-action`}
              className="bg-white aria-invalid:border-red-500"
              aria-invalid={isInvalid || undefined}>
              <SelectValue placeholder={t("workspace.creatives.editor.choose_action")} />
            </SelectTrigger>
            <SelectContent>
              {available.map(({ id, name }) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </EditorField>
      )}
    </div>
  );
};

/** Share of visitors, inside the Show when card: everyone who matches, or a share decided once per visitor. */
const ShareOfVisitors = ({
  displayPercentage,
  onChange,
}: Readonly<{ displayPercentage: number | null; onChange: (displayPercentage: number | null) => void }>) => {
  const { t } = useTranslation();
  const ids = useId();

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
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
          checked={displayPercentage !== null}
          onCheckedChange={(checked) => onChange(checked ? DEFAULT_SHARE : null)}
        />
      </div>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm",
          displayPercentage === null && "text-slate-500"
        )}>
        {displayPercentage === null ? (
          <>
            <UsersIcon className="size-4" aria-hidden="true" />
            {t("workspace.creatives.editor.everyone_who_matches")}
          </>
        ) : (
          <>
            <NumberStepper
              className="w-36 bg-white"
              aria-label={t("workspace.creatives.editor.share_of_visitors")}
              value={displayPercentage}
              onChange={onChange}
              min={1}
              max={100}
              step={5}
              unit="%"
            />
            <span className="text-slate-600">{t("workspace.creatives.editor.of_visitors")}</span>
          </>
        )}
      </div>
    </div>
  );
};

/** Show on, then Show when with Share of visitors inside it (ENG-4002). */
export const SettingsTab = ({
  distribution,
  onChange,
  actionOptions,
  showActionError,
  showConditionErrors,
}: Readonly<{
  distribution: TCreativeDistributionForm;
  onChange: (distribution: TCreativeDistributionForm) => void;
  actionOptions: TCreativeActionOption[];
  showActionError: boolean;
  showConditionErrors: boolean;
}>) => {
  const { t } = useTranslation();
  const update = (patch: Partial<TCreativeDistributionForm>) => onChange({ ...distribution, ...patch });

  return (
    <>
      <EditorPanel title={t("workspace.creatives.editor.show_on")} icon={EyeIcon}>
        <Segmented
          fill
          ariaLabel={t("workspace.creatives.editor.show_on")}
          value={distribution.showOn}
          onChange={(showOn) => update({ showOn })}
          options={[
            { value: "pageView", label: t("workspace.creatives.editor.every_page_view") },
            { value: "action", label: t("workspace.creatives.editor.when_action_fires") },
          ]}
        />
        {distribution.showOn === "action" && (
          <ActionPicker
            actionClassIds={distribution.actionClassIds}
            onChange={(actionClassIds) => update({ actionClassIds })}
            actionOptions={actionOptions}
            isInvalid={showActionError}
          />
        )}
      </EditorPanel>

      <ShowConditionsCard
        value={distribution.conditions}
        onChange={(conditions) => update({ conditions })}
        showErrors={showConditionErrors}>
        <ShareOfVisitors
          displayPercentage={distribution.displayPercentage}
          onChange={(displayPercentage) => update({ displayPercentage })}
        />
      </ShowConditionsCard>
    </>
  );
};
