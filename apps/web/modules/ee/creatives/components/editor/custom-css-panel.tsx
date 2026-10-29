"use client";

import { CodeIcon, LockIcon } from "lucide-react";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import type { TCustomCssInput } from "@formbricks/types/custom-css";
import { CssCodeField } from "@/modules/custom-css/components/css-code-field";
import { CustomCssIssues } from "@/modules/custom-css/components/custom-css-issues";
import { CustomCssPlanNotice } from "@/modules/custom-css/components/custom-css-plan-notice";
import { getCodeLineMarks } from "@/modules/custom-css/components/lib/code-field";
import {
  type TCustomCssDraft,
  getCustomCssByteLimit,
  getCustomCssByteSize,
  normalizeCustomCssInput,
  toCustomCssDraft,
} from "@/modules/custom-css/components/lib/draft";
import { getCustomCssEditMode } from "@/modules/custom-css/components/lib/edit-mode";
import type { TCustomCssValidationState } from "@/modules/custom-css/components/lib/validation";
import { Button } from "@/modules/ui/components/button";
import { useStylingAppearance } from "@/modules/ui/components/styling-appearance";
import { getCustomCssSummary } from "../../lib/panel-summaries";
import { CREATIVE_CSS_SCOPE } from "../../lib/style";
import { EditorPanel, type TEditorPanelFold } from "./editor-primitives";
import { CustomCssSummary } from "./panel-summaries";

export interface TCreativeCustomCssConfig {
  /** Cloud: the Scale `custom-css` entitlement. Self-hosted: always true. */
  planAllowed: boolean;
  billingHref: string | null;
}

/**
 * The creative's own Custom CSS (ENG-3865): a base field and a dark one, checked live and
 * compiled for the creative's root element, with the survey CSS plan gate. It doesn't offer the survey
 * CSS hints, which name the survey card's parts. The Light / Dark at the top of its body
 * (`appearanceSwitch`, shared with the Colors card and the preview) picks the field, so dark rules are
 * written against the dark creative.
 */
export const CustomCssPanel = ({
  className,
  source,
  onChange,
  validation,
  config,
  disabled,
  appearanceSwitch,
}: Readonly<{
  /** The CSS a feedback button or a banner targets. */
  className: string;
  source: TCustomCssInput | null | undefined;
  onChange: (source: TCustomCssInput) => void;
  validation: TCustomCssValidationState;
  config: TCreativeCustomCssConfig;
  /** Custom styles off: the field dims and locks; `appearanceSwitch` stays usable. */
  disabled: boolean;
  appearanceSwitch: ReactNode;
}>) => {
  const { t } = useTranslation();
  const appearance = useStylingAppearance();
  const id = useId();
  const fieldId = `${id}-field`;
  const helpId = `${id}-help`;
  const keyboardHintId = `${id}-keyboard-hint`;
  const statusId = `${id}-status`;
  const issuesId = `${id}-issues`;

  const draft: TCustomCssDraft = toCustomCssDraft(source);
  const mode = getCustomCssEditMode({ canEdit: true, planAllowed: config.planAllowed });
  const hasCss = normalizeCustomCssInput(draft) !== null;
  const canType = mode === "full" && !disabled;
  const byteLimit = getCustomCssByteLimit(CREATIVE_CSS_SCOPE);
  const byteSize = getCustomCssByteSize(draft);
  const hasFieldError = validation.errors.some(
    (error) => error.appearance === appearance || error.appearance === null
  );
  const hasIssues = validation.errors.length > 0 || validation.warnings.length > 0;
  const getAttention = (): TEditorPanelFold["attention"] => {
    if (validation.errors.length > 0 || byteSize > byteLimit) return "error";
    if (validation.warnings.length > 0) return "warning";
    return undefined;
  };
  const describedBy = [helpId, canType && keyboardHintId, statusId, hasIssues && issuesId]
    .filter(Boolean)
    .join(" ");
  const isDark = appearance === "dark";
  const fieldLabel = isDark
    ? t("workspace.custom_css.dark_css_label")
    : t("workspace.custom_css.base_css_label");
  const fieldHelp = isDark
    ? t("workspace.custom_css.dark_css_help")
    : t("workspace.custom_css.base_css_help");

  return (
    <EditorPanel
      title={t("workspace.custom_css.title")}
      icon={CodeIcon}
      description={t("workspace.creatives.editor.custom_css_description", { className })}
      fold={{
        id: "customCss",
        summary: <CustomCssSummary summary={getCustomCssSummary(source, !disabled)} />,
        attention: getAttention(),
      }}>
      {appearanceSwitch}
      {/* Outside the dimmed fieldset, so it reads as the way to unlock the card rather than part of it. */}
      {disabled && (
        <p className="flex items-start gap-1.5 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <LockIcon className="mt-px size-3.5 shrink-0 text-slate-500" aria-hidden="true" />
          {t("workspace.creatives.editor.custom_css_off_hint")}
        </p>
      )}
      <fieldset disabled={disabled} className="min-w-0 disabled:opacity-60">
        {mode === "clear-only" && !hasCss ? (
          <CustomCssPlanNotice billingHref={config.billingHref} hasSavedCss={false} />
        ) : (
          <div className="space-y-3">
            {mode === "clear-only" && <CustomCssPlanNotice billingHref={config.billingHref} hasSavedCss />}
            <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700">
              {fieldLabel}
            </label>
            <p id={helpId} className="text-xs text-slate-500">
              {fieldHelp}
            </p>
            <CssCodeField
              id={fieldId}
              value={draft[appearance]}
              onChange={canType ? (next) => onChange({ ...draft, [appearance]: next }) : undefined}
              offersSuggestions={false}
              keyboardHint={{ id: keyboardHintId, text: t("workspace.custom_css.keyboard_hint") }}
              marks={getCodeLineMarks(appearance, validation.errors, validation.warnings)}
              invalid={hasFieldError || byteSize > byteLimit}
              placeholder={canType ? `.${className} { border-width: 2px; }` : undefined}
              rows={8}
              aria-label={fieldLabel}
              aria-describedby={describedBy}
            />
            <CustomCssIssues
              statusId={statusId}
              issuesId={issuesId}
              validation={validation}
              byteSize={byteSize}
              byteLimit={byteLimit}
            />
            {mode === "clear-only" && (
              // Without the plan the field can't be typed in, so this is the only way to remove the CSS.
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || !hasCss}
                onClick={() => onChange({ light: "", dark: "" })}>
                {t("workspace.custom_css.clear_all")}
              </Button>
            )}
          </div>
        )}
      </fieldset>
    </EditorPanel>
  );
};
