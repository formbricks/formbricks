"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon, ExternalLinkIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { type ChangeEvent, type ReactNode, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type TCustomCssAppearance, type TCustomCssScope } from "@formbricks/types/custom-css";
import { cn } from "@/lib/cn";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@/modules/ui/components/label";
import { CssCodeField, type TCssCodeFieldHandle } from "./css-code-field";
import { CustomCssIssues } from "./custom-css-issues";
import { type TCustomCssHealthStatus } from "./lib/api-client";
import { getCodeLineMarks } from "./lib/code-field";
import { CUSTOM_CSS_DOCS_URL } from "./lib/constants";
import { type TCustomCssDraft, getCustomCssByteLimit, getCustomCssByteSize } from "./lib/draft";
import { type TCustomCssEditMode } from "./lib/edit-mode";
import { shouldShowDarkPreviewHint } from "./lib/hints";
import { CUSTOM_CSS_FILE_ACCEPT, checkCustomCssFile, stripByteOrderMark } from "./lib/upload";
import { type TCustomCssValidationState } from "./lib/validation";

interface CustomCssCardProps {
  scope: TCustomCssScope;
  /** The styling editor's Light / Dark selection (D14): Light edits base CSS, Dark edits dark rules. */
  appearance: TCustomCssAppearance;
  draft: TCustomCssDraft;
  onDraftChange: (draft: TCustomCssDraft) => void;
  validation: TCustomCssValidationState;
  mode: TCustomCssEditMode;
  /** Health of the saved CSS as the server reports it; `withheld` means respondents get none of it. */
  savedStatus?: TCustomCssHealthStatus;
  /** Self-hosted only: Custom Head Scripts in scope carry page styles (ENG-3415). */
  hasHeadScriptStyles?: boolean;
  /** Role or plan explanation shown above the field. */
  notice?: ReactNode;
  /** The survey editor's read-only inherited workspace CSS. */
  inherited?: ReactNode;
  /** Shown under the field, e.g. the workspace card's "Restore previous version". */
  footer?: ReactNode;
  /** Replaces the fields entirely, e.g. the upgrade prompt when the plan has no CSS to show. */
  lockedContent?: ReactNode;
  /** Greyed out and closed, like the survey editor's other styling cards without "Add custom styles". */
  disabled?: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  isSettingsPage?: boolean;
}

/**
 * The Custom CSS card shared by the Appearance settings and the survey editor's Styling tab (ENG-3553,
 * ENG-3723). One code field per appearance, with upload. It renders what it is given; the
 * check, the preview and saving belong to the caller.
 */
export const CustomCssCard = ({
  scope,
  appearance,
  draft,
  onDraftChange,
  validation,
  mode,
  savedStatus = "ok",
  hasHeadScriptStyles = false,
  notice,
  inherited,
  footer,
  lockedContent,
  disabled = false,
  open,
  setOpen,
  isSettingsPage = false,
}: Readonly<CustomCssCardProps>) => {
  const { t } = useTranslation();
  const id = useId();
  const fieldId = `${id}-field`;
  const helpId = `${id}-help`;
  const keyboardHintId = `${id}-keyboard-hint`;
  const statusId = `${id}-status`;
  const issuesId = `${id}-issues`;
  const uploadErrorId = `${id}-upload-error`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<TCssCodeFieldHandle>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const byteLimit = getCustomCssByteLimit(scope);
  const byteSize = getCustomCssByteSize(draft);
  const isOverLimit = byteSize > byteLimit;
  const value = draft[appearance];
  const canType = mode === "full";

  const hasFieldError = validation.errors.some(
    (error) => error.appearance === appearance || error.appearance === null
  );
  const hasIssues = validation.errors.length > 0 || validation.warnings.length > 0;
  const describedBy = [
    helpId,
    canType && keyboardHintId,
    statusId,
    hasIssues && issuesId,
    uploadError && uploadErrorId,
  ]
    .filter(Boolean)
    .join(" ");

  const setField = (next: string) => onDraftChange({ ...draft, [appearance]: next });

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so picking the same file again still fires a change.
    event.target.value = "";
    if (!file) return;

    const check = checkCustomCssFile(file, scope);
    if (!check.ok) {
      setUploadError(
        check.reason === "type"
          ? t("workspace.custom_css.upload_invalid_type")
          : t("workspace.custom_css.upload_too_large", { limit: byteLimit })
      );
      return;
    }

    try {
      const text = stripByteOrderMark(await file.text());
      setUploadError(null);
      // Typed into the field rather than set, so Undo brings back what the file replaced.
      if (fieldRef.current) fieldRef.current.replaceAll(text);
      else setField(text);
    } catch {
      setUploadError(t("workspace.custom_css.upload_read_failed"));
    }
  };

  const fieldLabel =
    appearance === "dark"
      ? t("workspace.custom_css.dark_css_label")
      : t("workspace.custom_css.base_css_label");

  return (
    <Collapsible.Root
      open={open && !disabled}
      onOpenChange={(next) => {
        if (!disabled) setOpen(next);
      }}
      className="w-full rounded-lg border border-slate-300 bg-white">
      {/* A real button, unlike the neighbouring styling cards' div triggers, so it is reachable by keyboard. */}
      <Collapsible.CollapsibleTrigger
        disabled={disabled}
        className={cn(
          "flex w-full rounded-lg px-4 py-4 text-left focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-slate-50"
        )}>
        {!isSettingsPage && (
          <span className="flex items-center pr-5 pl-2">
            <CheckIcon
              strokeWidth={3}
              className="size-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
              aria-hidden
            />
          </span>
        )}
        <span className="block">
          <span
            className={cn("block font-semibold text-slate-800", isSettingsPage ? "text-sm" : "text-base")}>
            {t("workspace.custom_css.title")}
          </span>
          <span className={cn("mt-1 block text-slate-500", isSettingsPage ? "text-xs" : "text-sm")}>
            {scope === "workspace"
              ? t("workspace.custom_css.description_workspace")
              : t("workspace.custom_css.description_survey")}
          </span>
        </span>
      </Collapsible.CollapsibleTrigger>

      <Collapsible.CollapsibleContent className="flex flex-col overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <hr className="py-1 text-slate-600" />
        {lockedContent ?? (
          <div className="flex flex-col gap-4 p-6 pt-2">
            {savedStatus === "withheld" && (
              <Alert variant="warning" size="small" role="status">
                <AlertDescription className="whitespace-normal">
                  {t("workspace.custom_css.withheld_warning")}
                </AlertDescription>
              </Alert>
            )}
            {savedStatus === "stale" && (
              <Alert variant="info" size="small" role="status">
                <AlertDescription className="whitespace-normal">
                  {t("workspace.custom_css.stale_info")}
                </AlertDescription>
              </Alert>
            )}
            {hasHeadScriptStyles && (
              <Alert variant="warning" size="small" role="status">
                <AlertDescription className="whitespace-normal">
                  {t("workspace.custom_css.head_scripts_warning")}
                </AlertDescription>
              </Alert>
            )}
            {appearance === "dark" && shouldShowDarkPreviewHint(draft) && (
              <Alert variant="info" size="small" role="status">
                <AlertDescription className="whitespace-normal">
                  {t("workspace.custom_css.dark_preview_hint")}
                </AlertDescription>
              </Alert>
            )}
            {notice}
            {inherited}

            <div className="flex flex-col gap-2">
              <div>
                <Label htmlFor={fieldId} className="block text-slate-800">
                  {fieldLabel}
                </Label>
                <p id={helpId} className="text-xs text-slate-500">
                  {appearance === "dark"
                    ? t("workspace.custom_css.dark_css_help")
                    : t("workspace.custom_css.base_css_help")}
                  {scope === "survey" && ` ${t("workspace.custom_css.survey_precedence")}`}
                </p>
              </div>
              <CssCodeField
                id={fieldId}
                handleRef={fieldRef}
                keyboardHint={{ id: keyboardHintId, text: t("workspace.custom_css.keyboard_hint") }}
                value={value}
                onChange={canType ? setField : undefined}
                marks={getCodeLineMarks(appearance, validation.errors, validation.warnings)}
                invalid={hasFieldError || isOverLimit}
                placeholder={canType ? '[data-fb-part="headline"] { color: #10283a; }' : undefined}
                rows={12}
                aria-describedby={describedBy}
              />
              {uploadError && (
                <p id={uploadErrorId} role="alert" className="text-xs text-red-700">
                  {uploadError}
                </p>
              )}
            </div>

            <CustomCssIssues
              statusId={statusId}
              issuesId={issuesId}
              validation={validation}
              byteSize={byteSize}
              byteLimit={byteLimit}
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" size="sm" variant="secondary" asChild>
                <Link href={CUSTOM_CSS_DOCS_URL} target="_blank" rel="noopener noreferrer">
                  {t("common.learn_more")}
                  <ExternalLinkIcon aria-hidden />
                </Link>
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                {canType && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={CUSTOM_CSS_FILE_ACCEPT}
                      className="hidden"
                      tabIndex={-1}
                      aria-hidden
                      onChange={handleFileChange}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => fileInputRef.current?.click()}>
                      <UploadIcon aria-hidden />
                      {t("workspace.custom_css.upload")}
                    </Button>
                  </>
                )}
                {mode === "clear-only" && (
                  // Without the plan the field cannot be typed in, so this is the only way to remove CSS.
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={draft.light === "" && draft.dark === ""}
                    onClick={() => onDraftChange({ light: "", dark: "" })}>
                    {t("workspace.custom_css.clear_all")}
                  </Button>
                )}
              </div>
            </div>

            {footer}
          </div>
        )}
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
