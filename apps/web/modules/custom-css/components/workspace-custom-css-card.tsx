"use client";

import { HistoryIcon, Loader2Icon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  CUSTOM_CSS_NOTE_CODES,
  type TCustomCssAppearance,
  type TCustomCssCompiled,
} from "@formbricks/types/custom-css";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { useBeforeUnloadPrompt } from "@/modules/ui/hooks/use-before-unload-prompt";
import { CustomCssCard } from "./custom-css-card";
import { CustomCssPlanNotice } from "./custom-css-plan-notice";
import { useWorkspaceCustomCssEditor } from "./hooks/use-workspace-custom-css";
import { normalizeCustomCssInput, toCustomCssDraft } from "./lib/draft";
import { canSubmitCustomCssDraft, getCustomCssEditMode } from "./lib/edit-mode";
import { type TWorkspaceCustomCssAccess } from "./types";

interface WorkspaceCustomCssCardProps {
  workspaceId: string;
  access: TWorkspaceCustomCssAccess;
  appearance: TCustomCssAppearance;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Receives the validated compiled CSS for the page's preview, only when it changes. */
  onPreviewCssChange: (css: TCustomCssCompiled | null) => void;
}

/**
 * Workspace Custom CSS in Look & Feel. Saved on its own, through `PATCH …/custom-css` and an explicit
 * confirmation, because it reaches every survey in the workspace; the theme form's Save is unrelated.
 * The draft previews in the page's theme preview and never publishes until saved.
 *
 * The draft lives here, not in the page's styling form, so typing re-renders this card only: the
 * preview hears about the CSS when its validated output changes, about once per debounced check,
 * rather than re-rendering the whole survey on every keystroke.
 */
export const WorkspaceCustomCssCard = ({
  workspaceId,
  access,
  appearance,
  open,
  setOpen,
  onPreviewCssChange,
}: Readonly<WorkspaceCustomCssCardProps>) => {
  const { t } = useTranslation();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const editor = useWorkspaceCustomCssEditor({ workspaceId, enabled: true });
  const { resource } = editor;
  const previewCss = editor.validation.previewCss;

  useEffect(() => {
    onPreviewCssChange(previewCss);
  }, [previewCss, onPreviewCssChange]);

  // The page loader and the resource answer the same questions; either one saying no is a no.
  const mode = getCustomCssEditMode({
    canEdit: access.canEdit && (resource?.canEdit ?? true),
    planAllowed: access.planAllowed && (resource?.planAllowed ?? true),
  });
  const canSubmit = canSubmitCustomCssDraft({
    mode,
    changeKind: editor.changeKind,
    status: editor.validation.status,
  });
  const isDirty = editor.changeKind !== "unchanged";
  // In-app navigation keeps the draft for the next visit (see `unsaved-draft.ts`); a reload, a closed
  // tab or a full navigation would lose it, so those ask first.
  useBeforeUnloadPrompt(() => isDirty, { enabled: mode !== "read-only" });

  const handleSave = async () => {
    try {
      const { warnings } = await editor.save(normalizeCustomCssInput(editor.draft));
      // Notes leave their declaration in place, so only removals are counted as removed.
      const removedCount = warnings.filter((warning) => !CUSTOM_CSS_NOTE_CODES.has(warning.code)).length;
      toast.success(
        removedCount > 0
          ? t("workspace.custom_css.saved_with_warnings", { count: removedCount })
          : t("workspace.custom_css.saved")
      );
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("workspace.custom_css.save_failed")));
    } finally {
      setIsConfirmOpen(false);
    }
  };

  const handleRestorePrevious = () => {
    if (!resource?.previous) return;
    editor.setDraft(toCustomCssDraft(resource.previous));
    toast.success(t("workspace.custom_css.restore_previous_loaded"));
  };

  let notice: ReactNode = null;
  if (mode === "read-only") {
    notice = (
      <Alert variant="info" size="small" role="status">
        <AlertDescription className="whitespace-normal">
          {t("workspace.custom_css.read_only_role")}
        </AlertDescription>
      </Alert>
    );
  } else if (mode === "clear-only") {
    notice = <CustomCssPlanNotice billingHref={access.billingHref} hasSavedCss />;
  }
  // Nothing saved and no plan for it: there is nothing to show or clear, only the upgrade.
  const lockedContent =
    mode === "clear-only" && !resource?.customCss ? (
      <CustomCssPlanNotice billingHref={access.billingHref} hasSavedCss={false} />
    ) : undefined;

  if (editor.isLoading || editor.loadError) {
    return (
      <div className="flex w-full items-center gap-3 rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-600">
        {editor.loadError ? (
          <span role="alert">{t("workspace.custom_css.load_failed")}</span>
        ) : (
          <>
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            <span>{t("workspace.custom_css.title")}</span>
          </>
        )}
      </div>
    );
  }

  const footer =
    mode === "read-only" ? null : (
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit}
          loading={editor.isSaving}
          onClick={() => setIsConfirmOpen(true)}>
          {t("workspace.custom_css.save")}
        </Button>
        {isDirty && (
          <Button type="button" size="sm" variant="ghost" onClick={editor.resetDraft}>
            {t("workspace.custom_css.discard_changes")}
          </Button>
        )}
        {mode === "full" && resource?.previous && (
          <Button type="button" size="sm" variant="ghost" onClick={handleRestorePrevious}>
            <HistoryIcon aria-hidden />
            {t("workspace.custom_css.restore_previous")}
          </Button>
        )}
        {isDirty && (
          <output className="text-xs text-slate-500">
            {editor.isDraftRestored
              ? t("workspace.custom_css.unsaved_changes_restored")
              : t("workspace.custom_css.unsaved_changes")}
          </output>
        )}
      </div>
    );

  return (
    <>
      <CustomCssCard
        scope="workspace"
        appearance={appearance}
        draft={editor.draft}
        onDraftChange={editor.setDraft}
        validation={editor.validation}
        mode={mode}
        savedStatus={resource?.status}
        hasHeadScriptStyles={access.hasHeadScriptStyles}
        notice={notice}
        footer={footer}
        lockedContent={lockedContent}
        open={open}
        setOpen={setOpen}
        isSettingsPage
      />
      <ConfirmationModal
        open={isConfirmOpen}
        setOpen={setIsConfirmOpen}
        title={t("workspace.custom_css.confirm_save_title")}
        description={t("workspace.custom_css.confirm_save_text")}
        body={t("workspace.custom_css.confirm_save_restore_hint")}
        buttonText={t("workspace.custom_css.confirm_save_button")}
        buttonVariant="default"
        buttonLoading={editor.isSaving}
        onConfirm={handleSave}
      />
    </>
  );
};
