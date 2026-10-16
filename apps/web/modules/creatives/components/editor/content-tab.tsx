"use client";

import {
  AlertTriangleIcon,
  LinkIcon,
  type LucideIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  MousePointerClickIcon,
  PanelTopIcon,
  SparklesIcon,
  SquareMousePointerIcon,
} from "lucide-react";
import { type Dispatch, type SetStateAction, useId } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { isRestrictedSurveyPick } from "@/modules/survey/visibility/lib/outbound";
import { Badge } from "@/modules/ui/components/badge";
import { Editor } from "@/modules/ui/components/editor";
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
import { bannerHtmlToRuns, bannerRunsToHtml } from "../../lib/banner-text";
import type { TDestinationSurveyOption } from "../../lib/destination-options";
import type {
  TBannerForm,
  TCreativeEditorForm,
  TFeedbackButtonForm,
  TFeedbackButtonIcon,
} from "../../lib/editor-form";
import type { TPublishIssue } from "../../lib/publish-check";
import { CREATIVE_TYPE_ICONS } from "../creative-icons";
import { EditorField, EditorPanel } from "./editor-primitives";
import { SurveyLanguageWarning } from "./survey-language-warning";

type TSetForm = Dispatch<SetStateAction<TCreativeEditorForm>>;

/** v3 text values hold at most 200 characters (`CreativeText`). */
export const MAX_TEXT_LENGTH = 200;

const ICONS: Record<TFeedbackButtonIcon, LucideIcon> = {
  messageSquare: MessageSquareIcon,
  messageCircle: MessageCircleIcon,
  megaphone: MegaphoneIcon,
  sparkles: SparklesIcon,
};
const ICON_OPTIONS = Object.keys(ICONS) as TFeedbackButtonIcon[];

/** The toolbar the banner message keeps: bold, italic, underline and links (no lists, headings, recall). */
export const BANNER_EXCLUDED_TOOLBAR_ITEMS = [
  "blockType",
  "bulletList",
  "orderedList",
  "recall",
  "editRecall",
];

const updateFeedbackButton =
  (patch: Partial<Omit<TFeedbackButtonForm, "type">>) =>
  (form: TCreativeEditorForm): TCreativeEditorForm =>
    form.content.type === "feedbackButton" ? { ...form, content: { ...form.content, ...patch } } : form;

const updateBanner =
  (patch: Partial<Omit<TBannerForm, "type">>) =>
  (form: TCreativeEditorForm): TCreativeEditorForm =>
    form.content.type === "banner" ? { ...form, content: { ...form.content, ...patch } } : form;

const IconPicker = ({
  value,
  onChange,
  labelId,
}: Readonly<{
  value: TFeedbackButtonIcon | null;
  onChange: (icon: TFeedbackButtonIcon | null) => void;
  labelId: string;
}>) => {
  const { t } = useTranslation();
  const iconLabels: Record<TFeedbackButtonIcon, string> = {
    messageSquare: t("workspace.creatives.editor.icon_message_square"),
    messageCircle: t("workspace.creatives.editor.icon_message_circle"),
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
        const Icon = ICONS[icon];
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

const SurveyPicker = ({
  surveyId,
  onChange,
  surveyOptions,
  linkedSurveyId,
  isInvalid,
  languages,
}: Readonly<{
  surveyId: string | null;
  onChange: (surveyId: string) => void;
  surveyOptions: TDestinationSurveyOption[];
  linkedSurveyId: string | null;
  isInvalid: boolean;
  languages: TCreativeEditorForm["languages"];
}>) => {
  const { t } = useTranslation();
  const survey = surveyOptions.find((option) => option.id === surveyId);
  // The creative's own survey stays selectable, as the server accepts it unchanged.
  const attachedSurveyIds = linkedSurveyId ? [linkedSurveyId] : [];
  // The creative rule applies whatever the organization's visibility plan (ENG-3868), hence `true`.
  const isUnavailable = (option: TDestinationSurveyOption) =>
    isRestrictedSurveyPick(true, option, attachedSurveyIds);
  const restrictedLabel = t("workspace.surveys.visibility.restricted");

  if (surveyOptions.length === 0) {
    return <p className="text-xs text-slate-500">{t("workspace.creatives.editor.no_surveys")}</p>;
  }

  return (
    <>
      <Select value={surveyId ?? undefined} onValueChange={onChange}>
        <SelectTrigger
          className="bg-white aria-invalid:border-red-500"
          aria-label={t("workspace.creatives.editor.choose_survey")}
          aria-invalid={isInvalid || undefined}>
          <SelectValue placeholder={t("workspace.creatives.editor.choose_survey")} />
        </SelectTrigger>
        <SelectContent>
          {surveyOptions.map((option) => {
            const isRestricted = isUnavailable(option);
            return (
              <SelectItem key={option.id} value={option.id} disabled={isRestricted}>
                <span className="flex items-center gap-2">
                  {option.type === "app" ? (
                    <MessageCircleIcon className="size-4 shrink-0 text-slate-500" />
                  ) : (
                    <LinkIcon className="size-4 shrink-0 text-slate-500" />
                  )}
                  <span className="truncate">{option.name}</span>
                  {isRestricted && <Badge size="tiny" type="gray" text={restrictedLabel} />}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {/* A disabled item takes no pointer events, so the reason is said once, under the picker. */}
      {surveyOptions.some(isUnavailable) && (
        <p className="text-xs text-slate-500">{t("workspace.creatives.editor.restricted_surveys_note")}</p>
      )}
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
      <SurveyLanguageWarning languages={languages} survey={survey ?? null} />
    </>
  );
};

type TOnClickPanelProps = {
  destination: TCreativeEditorForm["destination"];
  languages: TCreativeEditorForm["languages"];
  setForm: TSetForm;
  surveyOptions: TDestinationSurveyOption[];
  linkedSurveyId: string | null;
  issues: TPublishIssue[];
};

const OnClickPanel = ({
  destination,
  languages,
  setForm,
  surveyOptions,
  linkedSurveyId,
  issues,
}: Readonly<TOnClickPanelProps>) => {
  const { t } = useTranslation();
  const ids = useId();
  const setDestination = (next: TCreativeEditorForm["destination"]) =>
    setForm((form) => ({ ...form, destination: next }));

  const cardClass = (isSelected: boolean) =>
    cn(
      "flex gap-3 rounded-lg border p-4 transition-colors",
      isSelected ? "border-slate-900 bg-slate-50/60" : "border-slate-200 hover:border-slate-300"
    );

  return (
    <EditorPanel title={t("workspace.creatives.editor.on_click")} icon={MousePointerClickIcon}>
      <RadioGroup
        value={destination.type}
        onValueChange={(type) =>
          setDestination(type === "link" ? { type: "link", url: "" } : { type: "survey", surveyId: null })
        }
        className="gap-y-3">
        <div className={cardClass(destination.type === "survey")}>
          <RadioGroupItem value="survey" id={`${ids}-survey`} className="mt-0.5" />
          <div className="min-w-0 flex-1 space-y-3">
            <label htmlFor={`${ids}-survey`} className="block cursor-pointer space-y-0.5">
              <span className="block text-sm font-medium text-slate-900">
                {t("workspace.creatives.editor.open_survey")}
              </span>
              <span className="block text-xs text-slate-500">
                {t("workspace.creatives.editor.open_survey_description")}
              </span>
            </label>
            {destination.type === "survey" && (
              <SurveyPicker
                surveyId={destination.surveyId}
                onChange={(surveyId) => setDestination({ type: "survey", surveyId })}
                surveyOptions={surveyOptions}
                linkedSurveyId={linkedSurveyId}
                isInvalid={issues.includes("survey_missing")}
                languages={languages}
              />
            )}
          </div>
        </div>

        <div className={cardClass(destination.type === "link")}>
          <RadioGroupItem value="link" id={`${ids}-link`} className="mt-0.5" />
          <div className="min-w-0 flex-1 space-y-3">
            <label htmlFor={`${ids}-link`} className="block cursor-pointer space-y-0.5">
              <span className="block text-sm font-medium text-slate-900">
                {t("workspace.creatives.editor.open_link")}
              </span>
              <span className="block text-xs text-slate-500">
                {t("workspace.creatives.editor.open_link_description")}
              </span>
            </label>
            {destination.type === "link" && (
              <Input
                type="url"
                inputMode="url"
                className="bg-white"
                aria-label={t("common.url")}
                isInvalid={issues.includes("link_invalid")}
                aria-invalid={issues.includes("link_invalid") || undefined}
                placeholder="https://"
                maxLength={2048}
                value={destination.url}
                onChange={(event) => setDestination({ type: "link", url: event.target.value })}
              />
            )}
          </div>
        </div>
      </RadioGroup>
    </EditorPanel>
  );
};

const FeedbackButtonContent = ({
  content,
  setForm,
  issues,
}: Readonly<{ content: TFeedbackButtonForm; setForm: TSetForm; issues: TPublishIssue[] }>) => {
  const { t } = useTranslation();
  const ids = useId();
  return (
    <EditorPanel title={t("workspace.creatives.editor.button")} icon={CREATIVE_TYPE_ICONS.feedback_button}>
      <EditorField label={t("common.label")} htmlFor={`${ids}-label`}>
        <Input
          id={`${ids}-label`}
          placeholder={t("workspace.creatives.editor.label_placeholder")}
          maxLength={MAX_TEXT_LENGTH}
          isInvalid={issues.includes("label_missing")}
          aria-invalid={issues.includes("label_missing") || undefined}
          value={content.label}
          onChange={(event) => setForm(updateFeedbackButton({ label: event.target.value }))}
        />
      </EditorField>
      <div className="space-y-1.5">
        <p id={`${ids}-icon`} className="flex items-baseline gap-1.5 text-sm font-medium text-slate-700">
          {t("workspace.creatives.editor.icon")}
          <span className="text-xs font-normal text-slate-400">{t("common.optional")}</span>
        </p>
        <IconPicker
          labelId={`${ids}-icon`}
          value={content.icon}
          onChange={(icon) => setForm(updateFeedbackButton({ icon }))}
        />
      </div>
    </EditorPanel>
  );
};

const BannerContent = ({
  content,
  setForm,
  issues,
}: Readonly<{ content: TBannerForm; setForm: TSetForm; issues: TPublishIssue[] }>) => {
  const { t } = useTranslation();
  const ids = useId();
  const messageLabelId = `${ids}-message-label`;

  return (
    <>
      <EditorPanel title={t("workspace.creatives.editor.message")} icon={CREATIVE_TYPE_ICONS.banner}>
        <div className="space-y-1.5">
          <p id={messageLabelId} className="text-sm font-medium text-slate-700">
            {t("workspace.creatives.editor.message_text")}
          </p>
          {/* The editor reads `getText` once, on mount, and reports every change as HTML. */}
          <Editor
            id={messageLabelId}
            disableLists
            excludedToolbarItems={BANNER_EXCLUDED_TOOLBAR_ITEMS}
            isExternalUrlsAllowed
            placeholder={t("workspace.creatives.editor.message_placeholder")}
            isInvalid={issues.includes("message_missing")}
            getText={() => bannerRunsToHtml(content.message)}
            setText={(html) => setForm(updateBanner({ message: bannerHtmlToRuns(html) }))}
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2.5">
          <label htmlFor={`${ids}-dismissible`} className="text-sm text-slate-700">
            {t("workspace.creatives.editor.dismissible")}
          </label>
          <Switch
            id={`${ids}-dismissible`}
            checked={content.dismissible}
            onCheckedChange={(dismissible) => setForm(updateBanner({ dismissible }))}
          />
        </div>
        <EditorField
          label={t("workspace.creatives.editor.accessible_name")}
          htmlFor={`${ids}-accessible-name`}
          hint={t("common.optional")}>
          <Input
            id={`${ids}-accessible-name`}
            placeholder={t("workspace.creatives.editor.accessible_name_default")}
            maxLength={MAX_TEXT_LENGTH}
            aria-describedby={`${ids}-accessible-name-description`}
            value={content.accessibleName}
            onChange={(event) => setForm(updateBanner({ accessibleName: event.target.value }))}
          />
          <p id={`${ids}-accessible-name-description`} className="text-xs text-slate-500">
            {t("workspace.creatives.editor.accessible_name_description")}
          </p>
        </EditorField>
      </EditorPanel>

      <EditorPanel title={t("workspace.creatives.editor.button")} icon={SquareMousePointerIcon}>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor={`${ids}-has-button`} className="space-y-0.5">
            <span className="block text-sm font-medium text-slate-900">
              {t("workspace.creatives.editor.add_button")}
            </span>
            <span className="block text-xs text-slate-500">
              {t("workspace.creatives.editor.add_button_description")}
            </span>
          </label>
          <Switch
            id={`${ids}-has-button`}
            checked={content.hasButton}
            onCheckedChange={(hasButton) =>
              setForm(
                updateBanner(
                  hasButton && !content.buttonLabel
                    ? { hasButton, buttonLabel: t("workspace.creatives.editor.default_button_label") }
                    : { hasButton }
                )
              )
            }
          />
        </div>
        {content.hasButton && (
          <EditorField label={t("workspace.creatives.editor.button_label")} htmlFor={`${ids}-button-label`}>
            <Input
              id={`${ids}-button-label`}
              placeholder={t("workspace.creatives.editor.button_label_placeholder")}
              maxLength={MAX_TEXT_LENGTH}
              isInvalid={issues.includes("button_label_missing")}
              aria-invalid={issues.includes("button_label_missing") || undefined}
              value={content.buttonLabel}
              onChange={(event) => setForm(updateBanner({ buttonLabel: event.target.value }))}
            />
          </EditorField>
        )}
      </EditorPanel>
    </>
  );
};

export const ContentTab = ({
  form,
  setForm,
  surveyOptions,
  linkedSurveyId,
  issues,
}: Readonly<{
  form: TCreativeEditorForm;
  setForm: TSetForm;
  surveyOptions: TDestinationSurveyOption[];
  /** The survey the stored creative opens, which stays selectable whatever its visibility. */
  linkedSurveyId: string | null;
  issues: TPublishIssue[];
}>) => {
  const { content } = form;
  const onClick = (
    <OnClickPanel
      destination={form.destination}
      languages={form.languages}
      setForm={setForm}
      surveyOptions={surveyOptions}
      linkedSurveyId={linkedSurveyId}
      issues={issues}
    />
  );

  if (content.type === "banner") {
    return (
      <>
        <BannerContent content={content} setForm={setForm} issues={issues} />
        {content.hasButton && onClick}
      </>
    );
  }

  return (
    <>
      <FeedbackButtonContent content={content} setForm={setForm} issues={issues} />
      {onClick}
    </>
  );
};
