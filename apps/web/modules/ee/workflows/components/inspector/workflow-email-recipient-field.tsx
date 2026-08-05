"use client";

import { EyeOffIcon, MailIcon, TriangleAlertIcon, UserIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { cn } from "@/lib/cn";
import {
  WorkflowFieldError,
  WorkflowFieldLabel,
} from "@/modules/ee/workflows/components/inspector/workflow-field";
import {
  type EmailSendToOption,
  findEmailSendToOption,
} from "@/modules/survey/follow-ups/lib/email-send-to-options";
import { getElementIconMap } from "@/modules/survey/lib/elements";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

const FIELD_ID = "workflow-email-to";
const ERROR_ID = "workflow-email-to-error";
const UNAVAILABLE_ID = "workflow-email-to-unavailable";

type TElementIconMap = ReturnType<typeof getElementIconMap>;

// Module scope so each render reuses one function instead of rebuilding a closure per option.
const getSelectItemIcon = (type: EmailSendToOption["type"], elementIconMap: TElementIconMap): ReactNode => {
  switch (type) {
    case "verifiedEmail":
      return <MailIcon className="size-4" />;
    case "hiddenField":
      return <EyeOffIcon className="size-4" />;
    case "user":
      return <UserIcon className="size-4" />;
    case "openTextElement":
      return <div className="size-4">{elementIconMap[TSurveyElementTypeEnum.OpenText]}</div>;
    case "contactInfoElement":
      return <div className="size-4">{elementIconMap[TSurveyElementTypeEnum.ContactInfo]}</div>;
  }
};

const renderSelectItem = (option: EmailSendToOption, elementIconMap: TElementIconMap) => (
  <SelectItem key={option.id} value={option.id}>
    <div className="flex items-center gap-x-2">
      {getSelectItemIcon(option.type, elementIconMap)}
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{option.label}</span>
    </div>
  </SelectItem>
);

interface WorkflowEmailRecipientFieldProps {
  /** Selectable recipients derived from the trigger's bound survey. Empty = nothing to pick. */
  options: EmailSendToOption[];
  /** The stored `config.to`: an element id, hidden-field id, email, or "verifiedEmail". */
  value: string;
  isEditable: boolean;
  isInvalid: boolean;
  onChange: (value: string) => void;
  /** Called when the dropdown closes — this control's only "touched" moment (see the form). */
  onClose: () => void;
}

/**
 * The `send_email` recipient picker: a grouped Select over the bound survey's email-bearing
 * elements, hidden fields and the members who can access the workspace. Split out of
 * `WorkflowEmailActionForm` because it is the one field there with real internal structure (option
 * grouping, per-type icons, a no-options fallback), and it owns the only icon map and item renderer
 * in that form.
 */
export const WorkflowEmailRecipientField = ({
  options,
  value,
  isEditable,
  isInvalid,
  onChange,
  onClose,
}: Readonly<WorkflowEmailRecipientFieldProps>) => {
  const { t } = useTranslation();
  const elementIconMap = getElementIconMap(t);

  const optionsOfType = (...types: EmailSendToOption["type"][]) =>
    options.filter((option) => types.includes(option.type));

  // Declared as data so the three groups share one renderer. Verified email and question elements
  // deliberately sit under the same "Questions" heading, as in the survey Follow-Ups picker.
  const groups = [
    {
      label: t("common.questions"),
      options: optionsOfType("verifiedEmail", "openTextElement", "contactInfoElement"),
    },
    { label: t("common.hidden_fields"), options: optionsOfType("hiddenField") },
    { label: t("common.members"), options: optionsOfType("user") },
  ].filter((group) => group.options.length > 0);

  // A stored `to` that matches no option would otherwise render as the placeholder — Radix falls back
  // to it when nothing is selected — so the author sees an empty field while the definition still
  // holds (and the runner still tries) that recipient. Render it as its own flagged entry instead.
  // It covers both causes: a member who lost access to this workspace (ENG-2186) and an element or
  // hidden-field id left dangling by a survey edit. Matching goes through the same email
  // normalization the runtime allowlist uses, so a `to` that only differs in case from a member's
  // address is not flagged as unavailable while it still sends.
  const matchedOption = findEmailSendToOption(options, value);
  const isValueUnavailable = value !== "" && !matchedOption;

  // Radix selects by exact string match, so drive it with the resolved option's id — otherwise a
  // case-differing stored `to` would render as the placeholder, i.e. an empty field.
  const selectedValue = matchedOption?.id ?? (value || undefined);

  const describedBy = [isInvalid ? ERROR_ID : null, isValueUnavailable ? UNAVAILABLE_ID : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-2">
      <WorkflowFieldLabel htmlFor={FIELD_ID} isRequired isInvalid={isInvalid}>
        {t("workspace.workflows.email_to_label")}
      </WorkflowFieldLabel>
      <p className="text-xs text-slate-500">
        {t("workspace.surveys.edit.follow_ups_modal_action_to_description")}
      </p>
      {groups.length > 0 || isValueUnavailable ? (
        <Select
          value={selectedValue}
          disabled={!isEditable}
          onOpenChange={(isOpen) => {
            if (!isOpen) onClose();
          }}
          onValueChange={onChange}>
          <SelectTrigger
            id={FIELD_ID}
            aria-invalid={isInvalid}
            aria-describedby={describedBy || undefined}
            className={cn(
              "overflow-hidden bg-white text-ellipsis whitespace-nowrap",
              isInvalid && "border-red-500"
            )}>
            <SelectValue placeholder={t("workspace.workflows.email_to_placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {groups.map((group) => (
              <div key={group.label} className="flex flex-col">
                <div className="flex items-center gap-x-2 p-2">
                  <p className="text-sm text-slate-500">{group.label}</p>
                </div>
                {group.options.map((option) => renderSelectItem(option, elementIconMap))}
              </div>
            ))}
            {isValueUnavailable ? (
              <div className="flex flex-col">
                <div className="flex items-center gap-x-2 p-2">
                  <p className="text-sm text-slate-500">
                    {t("workspace.workflows.email_to_unavailable_group_label")}
                  </p>
                </div>
                <SelectItem value={value}>
                  <div className="flex items-center gap-x-2 text-warning-foreground">
                    <TriangleAlertIcon className="size-4 shrink-0 text-warning" aria-hidden="true" />
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap">{value}</span>
                  </div>
                </SelectItem>
              </div>
            ) : null}
          </SelectContent>
        </Select>
      ) : (
        <div className="flex items-start gap-2 text-warning-foreground">
          <TriangleAlertIcon className="mt-0.5 size-4 min-h-4 min-w-4 text-warning" aria-hidden="true" />
          <p className="text-sm">{t("workspace.surveys.edit.follow_ups_modal_action_to_warning")}</p>
        </div>
      )}
      {isValueUnavailable ? (
        <p id={UNAVAILABLE_ID} className="text-sm text-warning-foreground">
          {t("workspace.workflows.email_to_unavailable_warning")}
        </p>
      ) : null}
      {isInvalid ? (
        <WorkflowFieldError id={ERROR_ID}>{t("workspace.workflows.email_to_required")}</WorkflowFieldError>
      ) : null}
    </div>
  );
};
