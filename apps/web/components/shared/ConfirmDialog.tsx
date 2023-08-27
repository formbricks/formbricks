"use client";

import { Dialog, DialogContent } from "@formbricks/ui";
import { Button } from "@formbricks/ui";
import React from "react";

type ConfirmDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  title: string;
  description: string;
  primaryAction: () => void;
  secondaryAction: () => void;
  primaryActionText: string;
  secondaryActionText: string;
};

const ConfirmDialog = (props: ConfirmDialogProps) => {
  const {
    description,
    open,
    primaryAction,
    primaryActionText,
    secondaryAction,
    secondaryActionText,
    setOpen,
    title,
  } = props;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xs bg-slate-50 sm:max-w-sm" hideCloseButton>
        <div className="flex flex-col items-center justify-center gap-4">
          <h4 className="text-base font-semibold">{title}</h4>

          <p className="text-base text-slate-600">{description}</p>

          <div className="flex w-full items-center justify-center gap-6">
            <Button variant="minimal" size="sm" onClick={secondaryAction}>
              {secondaryActionText}
            </Button>

            <Button variant="minimal" size="sm" onClick={primaryAction}>
              {primaryActionText}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmDialog;
