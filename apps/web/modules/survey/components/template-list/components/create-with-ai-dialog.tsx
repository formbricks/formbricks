"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useRef, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import type { TUserLocale } from "@formbricks/types/user";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { CreateWithAIForm } from "@/modules/survey/components/template-list/components/create-with-ai-form";
import { AiIcon } from "@/modules/ui/components/ai";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/modules/ui/components/dialog";

type CreateWithAIDialogProps = {
  workspaceId: string;
  language: TUserLocale;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const CreateWithAIDialog = ({
  workspaceId,
  language,
  isAIAvailable,
  aiUnavailableReason,
  trigger,
  open,
  onOpenChange,
}: Readonly<CreateWithAIDialogProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isNavigating, startEditorNavigationTransition] = useTransition();
  const [hasUnsavedWork, setHasUnsavedWork] = useState(false);
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const commitOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  const setDialogOpen = (nextOpen: boolean) => {
    if (isNavigating && !nextOpen) return;

    // Reloading the page already warns; closing the dialog throws away the same work, so it asks
    // too rather than silently discarding a generation the user waited for.
    if (!nextOpen && hasUnsavedWork) {
      setIsConfirmingDiscard(true);
      return;
    }

    commitOpenChange(nextOpen);
  };

  const handleSuccess = (surveyId: string) => {
    startEditorNavigationTransition(() => {
      router.push(`/workspaces/${workspaceId}/surveys/${surveyId}/edit`);
    });
  };

  const handleOpenAutoFocus = (event: Event) => {
    if (!isAIAvailable) return;

    event.preventDefault();
    globalThis.requestAnimationFrame(() => {
      promptInputRef.current?.focus();
    });
  };

  // Read as plain calls rather than inside the ternary below: the translation scanner only sees
  // `t("literal")`, so a key passed through a conditional expression reads as unused and is pruned.
  const discardGenerationTitle = t("workspace.surveys.ai_create.discard_generation_title");
  const discardDraftTitle = t("workspace.surveys.ai_create.discard_draft_title");
  const discardGenerationBody = t("workspace.surveys.ai_create.discard_generation_body");
  const discardDraftBody = t("workspace.surveys.ai_create.discard_draft_body");

  return (
    <Dialog open={isOpen} onOpenChange={setDialogOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        // One width for every state. A centred modal that grows when you press Create is the most
        // obvious jank available, and the generating view needs the room.
        width="default"
        className="overflow-hidden"
        onOpenAutoFocus={handleOpenAutoFocus}
        // A stray click outside must not kill a twenty-second generation, but Escape should still
        // work — disableCloseOnOutsideClick swallows it unless closeOnEscape opts back in.
        disableCloseOnOutsideClick
        closeOnEscape>
        <DialogHeader>
          {/* DialogHeader colours its icon through [&>svg]:text-primary, an arbitrary variant that
              sorts after plain utilities and so beats the kit's own text-ai. The mark has to keep
              its colour here of all places, so assert it. */}
          <AiIcon aria-hidden="true" className="text-ai-dark!" />
          <DialogTitle>{t("workspace.surveys.ai_create.dialog_title")}</DialogTitle>
          <DialogDescription>{t("workspace.surveys.ai_create.dialog_description")}</DialogDescription>
        </DialogHeader>

        {/* Fixed height, not min-height: the modal reaches its final geometry on first paint and
            never moves again — not on submit, not as questions append, not on completion.
            flex-none is load-bearing: DialogBody is flex-1 by default, which makes it size to its
            content and the height a no-op. */}
        <DialogBody unconstrained className="-mx-1 -mt-1 flex h-[26rem] flex-none flex-col px-1 pt-1 pb-1">
          <CreateWithAIForm
            workspaceId={workspaceId}
            language={language}
            isAIAvailable={isAIAvailable}
            aiUnavailableReason={aiUnavailableReason}
            onSuccess={handleSuccess}
            promptInputRef={promptInputRef}
            showCancel
            isHostNavigating={isNavigating}
            onUnsavedWorkChange={(unsaved) => {
              setHasUnsavedWork(unsaved);
            }}
            onGeneratingChange={setIsGenerating}
            onCancel={() => setDialogOpen(false)}
            renderFooter={(footer) => <DialogFooter>{footer}</DialogFooter>}
          />
        </DialogBody>
      </DialogContent>

      <ConfirmationModal
        open={isConfirmingDiscard}
        setOpen={setIsConfirmingDiscard}
        title={isGenerating ? discardGenerationTitle : discardDraftTitle}
        body={isGenerating ? discardGenerationBody : discardDraftBody}
        buttonText={t("workspace.surveys.ai_create.discard")}
        buttonVariant="destructive"
        cancelButtonText={t("workspace.surveys.ai_create.keep_editing")}
        onConfirm={() => {
          setIsConfirmingDiscard(false);
          setHasUnsavedWork(false);
          commitOpenChange(false);
        }}
      />
    </Dialog>
  );
};
