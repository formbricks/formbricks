"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon, EraserIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { type ChangeEvent, type ReactNode, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type TCustomCssAppearance, type TCustomCssScope } from "@formbricks/types/custom-css";
import { cn } from "@/lib/cn";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { Label } from "@/modules/ui/components/label";
import { Textarea } from "@/modules/ui/components/textarea";
import { CustomCssIssues } from "./custom-css-issues";
import { type TCustomCssHealthStatus } from "./lib/api-client";
import { CUSTOM_CSS_DOCS_URL } from "./lib/constants";
import {
  type TCustomCssDraft,
  getCompiledByteSize,
  getCustomCssByteLimit,
  getCustomCssByteSize,
} from "./lib/draft";
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
  /** The workspace card's save controls; the survey's CSS is saved with the survey. */
  footer?: ReactNode;
  /** Replaces the fields entirely, e.g. the upgrade prompt when the plan has no CSS to show. */
  lockedContent?: ReactNode;
  open: boolean;
  setOpen: (open: boolean) => void;
  isSettingsPage?: boolean;
}

/**
 * The Custom CSS card shared by workspace Look & Feel and the survey editor's Styling tab (ENG-3553).
 * Plain monospace textareas, one per appearance, with upload, clear and a byte counter. It renders
 * what it is given; the check, the preview and saving belong to the caller.
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
  open,
  setOpen,
  isSettingsPage = false,
}: Readonly<CustomCssCardProps>) => {
  const { t } = useTranslation();
  const id = useId();
  const fieldId = `${id}-field`;
  const helpId = `${id}-help`;
  const statusId = `${id}-status`;
  const issuesId = `${id}-issues`;
  const uploadErrorId = `${id}-upload-error`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Clearing or replacing CSS that is already there asks first: a wiped field is saved by the survey
  // editor's auto-save before anyone notices.
  const [pendingReplace, setPendingReplace] = useState<{ title: string; apply: () => void } | null>(null);

  const byteLimit = getCustomCssByteLimit(scope);
  const byteSize = getCustomCssByteSize(draft);
  const isOverLimit = byteSize > byteLimit;
  const value = draft[appearance];
  // Only meaningful for a draft whose own check passed; an earlier draft's output would mislead.
  const processedSize =
    validation.status === "valid" && !validation.isPreviewBehind
      ? getCompiledByteSize(validation.previewCss)
      : null;
  const canType = mode === "full";
  const canClear = mode !== "read-only";

  const hasFieldError = validation.errors.some(
    (error) => error.appearance === appearance || error.appearance === null
  );
  const hasIssues = validation.errors.length > 0 || validation.warnings.length > 0;
  const describedBy = [helpId, statusId, hasIssues && issuesId, uploadError && uploadErrorId]
    .filter(Boolean)
    .join(" ");

  const setField = (field: TCustomCssAppearance, next: string) => onDraftChange({ ...draft, [field]: next });

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
      const apply = () => setField(appearance, text);
      if (draft[appearance].trim() === "") apply();
      else setPendingReplace({ title: t("workspace.custom_css.confirm_replace_title"), apply });
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
      open={open}
      onOpenChange={setOpen}
      className="w-full rounded-lg border border-slate-300 bg-white">
      {/* A real button, unlike the neighbouring styling cards' div triggers, so it is reachable by keyboard. */}
      <Collapsible.CollapsibleTrigger className="flex w-full cursor-pointer rounded-lg px-4 py-4 text-left hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none">
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
            <p id={helpId} className="text-sm text-slate-500">
              {appearance === "dark"
                ? t("workspace.custom_css.dark_css_help")
                : t("workspace.custom_css.base_css_help")}{" "}
              {scope === "survey" && `${t("workspace.custom_css.survey_precedence")} `}
              <Link
                href={CUSTOM_CSS_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-700 underline underline-offset-2">
                {t("workspace.custom_css.docs_link")}
              </Link>
            </p>

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
              <Label htmlFor={fieldId}>{fieldLabel}</Label>
              <Textarea
                id={fieldId}
                value={value}
                onChange={(event) => setField(appearance, event.target.value)}
                readOnly={!canType}
                rows={12}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                placeholder={canType ? '[data-fb-part="headline"] { color: #10283a; }' : undefined}
                aria-invalid={hasFieldError || isOverLimit}
                aria-describedby={describedBy}
                isInvalid={hasFieldError || isOverLimit}
                className={cn(
                  "min-h-48 resize-y bg-white font-mono text-xs leading-relaxed",
                  !canType && "cursor-default bg-slate-50 text-slate-600"
                )}
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
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
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}>
                        <UploadIcon aria-hidden />
                        {t("workspace.custom_css.upload")}
                      </Button>
                    </>
                  )}
                  {canClear && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={value === ""}
                        onClick={() =>
                          setPendingReplace({
                            title: t("workspace.custom_css.confirm_clear_field_title", { field: fieldLabel }),
                            apply: () => setField(appearance, ""),
                          })
                        }>
                        <EraserIcon aria-hidden />
                        {t("workspace.custom_css.clear_field")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={draft.light === "" && draft.dark === ""}
                        onClick={() =>
                          setPendingReplace({
                            title: t("workspace.custom_css.confirm_clear_all_title"),
                            apply: () => onDraftChange({ light: "", dark: "" }),
                          })
                        }>
                        {t("workspace.custom_css.clear_all")}
                      </Button>
                    </>
                  )}
                </div>
                <span
                  className={cn(
                    "flex flex-col items-end text-xs tabular-nums",
                    isOverLimit ? "text-red-700" : "text-slate-500"
                  )}>
                  <span>
                    {t("workspace.custom_css.byte_counter_total", { used: byteSize, limit: byteLimit })}
                  </span>
                  {processedSize !== null && processedSize > 0 && (
                    <span className={cn(processedSize > byteLimit && "text-red-700")}>
                      {t("workspace.custom_css.byte_counter_processed", {
                        used: processedSize,
                        limit: byteLimit,
                      })}
                    </span>
                  )}
                </span>
              </div>

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

            {footer}
          </div>
        )}
      </Collapsible.CollapsibleContent>
      <ConfirmationModal
        open={pendingReplace !== null}
        setOpen={(next) => {
          if (next === false) setPendingReplace(null);
        }}
        title={pendingReplace?.title ?? ""}
        // As the description, which otherwise defaults to "cannot be undone" — the workspace draft can be.
        description={
          scope === "survey"
            ? t("workspace.custom_css.confirm_replace_survey_body")
            : t("workspace.custom_css.confirm_replace_workspace_body")
        }
        body={null}
        buttonText={t("workspace.custom_css.confirm_replace_button")}
        buttonVariant="destructive"
        onConfirm={() => {
          pendingReplace?.apply();
          setPendingReplace(null);
        }}
      />
    </Collapsible.Root>
  );
};
