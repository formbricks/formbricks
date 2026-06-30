"use client";

import { SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import type { TUserLocale } from "@formbricks/types/user";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { CreateWithAIForm } from "@/modules/survey/components/template-list/components/create-with-ai-form";
import { Button } from "@/modules/ui/components/button";
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
  const isBusy = isNavigating;

  const setDialogOpen = (nextOpen: boolean) => {
    if (isBusy && !nextOpen) return;

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
    if (!isAIAvailable || isBusy) return;

    event.preventDefault();
    globalThis.requestAnimationFrame(() => {
      promptInputRef.current?.focus();
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setDialogOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        width="narrow"
        className="overflow-hidden"
        onOpenAutoFocus={handleOpenAutoFocus}
        disableCloseOnOutsideClick={isBusy}>
        <DialogHeader>
          <SparklesIcon aria-hidden="true" />
          <DialogTitle>{t("workspace.surveys.ai_create.dialog_title")}</DialogTitle>
          <DialogDescription>{t("workspace.surveys.ai_create.dialog_description")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="-mx-1 space-y-4 px-1 pb-1">
          <CreateWithAIForm
            workspaceId={workspaceId}
            language={language}
            isAIAvailable={isAIAvailable}
            aiUnavailableReason={aiUnavailableReason}
            onSuccess={handleSuccess}
            promptInputRef={promptInputRef}
            showCancel={false}
            renderFooter={({ isBusy: isFormBusy, canCreate, submitLabel }) => (
              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isFormBusy || isBusy}
                  onClick={() => setDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" loading={isFormBusy || isBusy} disabled={!canCreate}>
                  {!isFormBusy && !isBusy && <SparklesIcon />}
                  {submitLabel}
                </Button>
              </DialogFooter>
            )}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
