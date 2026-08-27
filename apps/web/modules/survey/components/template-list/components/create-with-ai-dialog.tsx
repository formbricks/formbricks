"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import type { TUserLocale } from "@formbricks/types/user";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { CreateWithAIForm } from "@/modules/survey/components/template-list/components/create-with-ai-form";
import { AiIcon } from "@/modules/ui/components/ai";
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
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const setDialogOpen = (nextOpen: boolean) => {
    if (isNavigating && !nextOpen) return;

    if (!isControlled) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
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
          <AiIcon aria-hidden="true" />
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
            onCancel={() => setDialogOpen(false)}
            renderFooter={(footer) => <DialogFooter>{footer}</DialogFooter>}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
