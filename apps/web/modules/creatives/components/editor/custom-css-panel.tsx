"use client";

import { CodeIcon } from "lucide-react";
import { useId } from "react";
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
import { CREATIVE_CSS_SCOPE } from "../../lib/style";
import { EditorPanel } from "./editor-primitives";

export interface TCreativeCustomCssConfig {
  /** Cloud: the Scale `custom-css` entitlement. Self-hosted: always true. */
  planAllowed: boolean;
  billingHref: string | null;
}

/**
 * The creative's own Custom CSS (ENG-3865, ADR 0012): a base field and a dark one, checked live and
 * compiled for the creative's root element, with the survey CSS plan gate. It doesn't offer the survey
 * CSS hints, which name the survey card's parts. The Styling tab's Light / Dark picks the field, and
 * the preview shows the same appearance, so dark rules are written against the dark creative.
 */
export const CustomCssPanel = ({
  className,
  source,
  onChange,
  validation,
  config,
  disabled,
}: Readonly<{
  /** The CSS a feedback button or a banner targets. */
  className: string;
  source: TCustomCssInput | null | undefined;
  onChange: (source: TCustomCssInput) => void;
  validation: TCustomCssValidationState;
  config: TCreativeCustomCssConfig;
  disabled: boolean;
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
  const describedBy = [helpId, canType && keyboardHintId, statusId, hasIssues && issuesId]
    .filter(Boolean)
    .join(" ");

  return (
    <EditorPanel
      title={t("workspace.custom_css.title")}
      icon={CodeIcon}
      description={t("workspace.creatives.editor.custom_css_description", { className })}>
      {mode === "clear-only" && !hasCss ? (
        <CustomCssPlanNotice billingHref={config.billingHref} hasSavedCss={false} />
      ) : (
        <div className="space-y-3">
          {mode === "clear-only" && <CustomCssPlanNotice billingHref={config.billingHref} hasSavedCss />}
          <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700">
            {appearance === "dark"
              ? t("workspace.custom_css.dark_css_label")
              : t("workspace.custom_css.base_css_label")}
          </label>
          <p id={helpId} className="text-xs text-slate-500">
            {appearance === "dark"
              ? t("workspace.custom_css.dark_css_help")
              : t("workspace.custom_css.base_css_help")}
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
            aria-label={
              appearance === "dark"
                ? t("workspace.custom_css.dark_css_label")
                : t("workspace.custom_css.base_css_label")
            }
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
    </EditorPanel>
  );
};
