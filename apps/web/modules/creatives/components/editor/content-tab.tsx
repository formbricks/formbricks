"use client";

import {
  AlertTriangleIcon,
  LinkIcon,
  MessageCircleIcon,
  MousePointerClickIcon,
  PanelTopIcon,
} from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Input } from "@/modules/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@/modules/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";
import { MOCK_SURVEYS } from "../../mock/data";
import type { TCreative, TCreativeIcon } from "../../types";
import { CREATIVE_CONTENT_ICONS, CREATIVE_TYPE_ICONS } from "../creative-icons";
import { EditorField, EditorPanel } from "./editor-primitives";

interface TContentTabProps {
  creative: TCreative;
  onChange: (creative: TCreative) => void;
}

const ICON_OPTIONS = Object.keys(CREATIVE_CONTENT_ICONS) as TCreativeIcon[];

const IconPicker = ({
  value,
  onChange,
  labelId,
}: Readonly<{
  value: TCreativeIcon | null;
  onChange: (icon: TCreativeIcon | null) => void;
  labelId: string;
}>) => {
  const { t } = useTranslation();
  const iconLabels: Record<TCreativeIcon, string> = {
    message_square: t("workspace.creatives.editor.icon_message_square"),
    message_circle: t("workspace.creatives.editor.icon_message_circle"),
    megaphone: t("workspace.creatives.editor.icon_megaphone"),
    sparkles: t("workspace.creatives.editor.icon_sparkles"),
  };
  const optionClass = (isSelected: boolean) =>
    cn(
      "flex h-9 min-w-9 items-center justify-center rounded-md border px-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden",
      isSelected
        ? "border-slate-900 bg-slate-900 text-white"
        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
    );
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        className={optionClass(value === null)}
        onClick={() => onChange(null)}>
        {t("workspace.creatives.editor.icon_none")}
      </button>
      {ICON_OPTIONS.map((icon) => {
        const Icon = CREATIVE_CONTENT_ICONS[icon];
        return (
          <button
            key={icon}
            type="button"
            role="radio"
            aria-checked={value === icon}
            aria-label={iconLabels[icon]}
            className={optionClass(value === icon)}
            onClick={() => onChange(icon)}>
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
};

const OnClickPanel = ({ creative, onChange }: Readonly<TContentTabProps>) => {
  const { t } = useTranslation();
  const urlId = useId();
  const { action } = creative;
  const survey =
    action.kind === "survey" ? MOCK_SURVEYS.find((option) => option.id === action.surveyId) : undefined;

  const cardClass = (isSelected: boolean) =>
    cn(
      "flex gap-3 rounded-lg border p-4 transition-colors",
      isSelected ? "border-slate-900 bg-slate-50/60" : "border-slate-200 hover:border-slate-300"
    );

  return (
    <EditorPanel title={t("workspace.creatives.editor.on_click")} icon={MousePointerClickIcon}>
      <RadioGroup
        value={action.kind}
        onValueChange={(kind) =>
          onChange({
            ...creative,
            action: kind === "survey" ? { kind: "survey", surveyId: null } : { kind: "link", url: "" },
          })
        }
        className="gap-y-3">
        <div className={cardClass(action.kind === "survey")}>
          <RadioGroupItem value="survey" id={`${urlId}-survey`} className="mt-0.5" />
          <div className="min-w-0 flex-1 space-y-3">
            <label htmlFor={`${urlId}-survey`} className="block cursor-pointer space-y-0.5">
              <span className="block text-sm font-medium text-slate-900">
                {t("workspace.creatives.editor.open_survey")}
              </span>
              <span className="block text-xs text-slate-500">
                {t("workspace.creatives.editor.open_survey_description")}
              </span>
            </label>
            {action.kind === "survey" && (
              <>
                <Select
                  value={action.surveyId ?? undefined}
                  onValueChange={(surveyId) =>
                    onChange({ ...creative, action: { kind: "survey", surveyId } })
                  }>
                  <SelectTrigger
                    className="bg-white"
                    aria-label={t("workspace.creatives.editor.choose_survey")}>
                    <SelectValue placeholder={t("workspace.creatives.editor.choose_survey")} />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_SURVEYS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        <span className="flex items-center gap-2">
                          {option.type === "app" ? (
                            <MessageCircleIcon className="size-4 text-slate-500" />
                          ) : (
                            <LinkIcon className="size-4 text-slate-500" />
                          )}
                          {option.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {survey && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <PanelTopIcon className="size-3.5" aria-hidden="true" />
                    {survey.type === "app"
                      ? t("workspace.creatives.editor.app_survey_opens_as_popup")
                      : t("workspace.creatives.editor.link_survey_opens_in_tab")}
                  </p>
                )}
                {survey && survey.status !== "inProgress" && (
                  <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangleIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    {t("workspace.creatives.editor.survey_not_running")}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className={cardClass(action.kind === "link")}>
          <RadioGroupItem value="link" id={`${urlId}-link`} className="mt-0.5" />
          <div className="min-w-0 flex-1 space-y-3">
            <label htmlFor={`${urlId}-link`} className="block cursor-pointer space-y-0.5">
              <span className="block text-sm font-medium text-slate-900">
                {t("workspace.creatives.editor.open_link")}
              </span>
              <span className="block text-xs text-slate-500">
                {t("workspace.creatives.editor.open_link_description")}
              </span>
            </label>
            {action.kind === "link" && (
              <Input
                type="url"
                inputMode="url"
                className="bg-white"
                aria-label={t("common.url")}
                placeholder="https://"
                value={action.url}
                onChange={(event) =>
                  onChange({ ...creative, action: { kind: "link", url: event.target.value } })
                }
              />
            )}
          </div>
        </div>
      </RadioGroup>
    </EditorPanel>
  );
};

export const ContentTab = ({ creative, onChange }: Readonly<TContentTabProps>) => {
  const { t } = useTranslation();
  const ids = useId();
  const setContent = (patch: Partial<TCreative["content"]>) =>
    onChange({ ...creative, content: { ...creative.content, ...patch } });

  if (creative.type === "banner") {
    return (
      <>
        <EditorPanel title={t("workspace.creatives.editor.message")} icon={CREATIVE_TYPE_ICONS.banner}>
          <EditorField label={t("workspace.creatives.editor.message_text")} htmlFor={`${ids}-message`}>
            <Input
              id={`${ids}-message`}
              placeholder={t("workspace.creatives.editor.message_placeholder")}
              value={creative.content.message}
              onChange={(event) => setContent({ message: event.target.value })}
            />
          </EditorField>
          <EditorField label={t("workspace.creatives.editor.button_label")} htmlFor={`${ids}-cta`}>
            <Input
              id={`${ids}-cta`}
              placeholder={t("workspace.creatives.editor.button_label_placeholder")}
              value={creative.content.label}
              onChange={(event) => setContent({ label: event.target.value })}
            />
          </EditorField>
          <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2.5">
            <label htmlFor={`${ids}-dismissible`} className="text-sm text-slate-700">
              {t("workspace.creatives.editor.dismissible")}
            </label>
            <Switch
              id={`${ids}-dismissible`}
              checked={creative.content.dismissible}
              onCheckedChange={(dismissible) => setContent({ dismissible })}
            />
          </div>
        </EditorPanel>
        <OnClickPanel creative={creative} onChange={onChange} />
      </>
    );
  }

  return (
    <>
      <EditorPanel title={t("workspace.creatives.editor.button")} icon={CREATIVE_TYPE_ICONS.feedback_button}>
        <EditorField label={t("common.label")} htmlFor={`${ids}-label`}>
          <Input
            id={`${ids}-label`}
            placeholder={t("workspace.creatives.editor.label_placeholder")}
            value={creative.content.label}
            onChange={(event) => setContent({ label: event.target.value })}
          />
        </EditorField>
        <div className="space-y-1.5">
          <p id={`${ids}-icon`} className="flex items-baseline gap-1.5 text-sm font-medium text-slate-700">
            {t("workspace.creatives.editor.icon")}
            <span className="text-xs font-normal text-slate-400">{t("common.optional")}</span>
          </p>
          <IconPicker
            labelId={`${ids}-icon`}
            value={creative.content.icon}
            onChange={(icon) => setContent({ icon })}
          />
        </div>
      </EditorPanel>
      <OnClickPanel creative={creative} onChange={onChange} />
    </>
  );
};
