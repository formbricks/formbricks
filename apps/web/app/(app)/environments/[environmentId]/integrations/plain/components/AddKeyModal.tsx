"use client";

import { Button } from "@/modules/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { useTranslate } from "@tolgee/react";
import { KeyIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { connectPlainIntegrationAction } from "../actions";

interface AddKeyModalProps {
  environmentId: string;
  open?: boolean;
  setOpen?: (open: boolean) => void;
}

export const AddKeyModal = ({
  environmentId,
  open: externalOpen,
  setOpen: externalSetOpen,
}: AddKeyModalProps) => {
  const { t } = useTranslate();
  const [internalOpen, setInternalOpen] = useState(false);
  const [keyLabel, setKeyLabel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const open = externalOpen ?? internalOpen;
  const setOpen = externalSetOpen || setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <div className="mr-1.5 h-6 w-6 text-slate-500">
              <KeyIcon className="h-5 w-5" />
            </div>
            <div>
              <span className="font-medium">{t("environments.integrations.plain.add_key")}</span>
              <p className="text-sm font-normal text-slate-500">
                {t("environments.integrations.plain.add_key_description")}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="p-6">
          <div className="mb-4">
            <label htmlFor="keyLabel" className="mb-2 block text-sm font-medium text-slate-700">
              {t("environments.integrations.plain.api_key_label")}
            </label>
            <Input
              id="keyLabel"
              name="keyLabel"
              placeholder="plainApiKey_123"
              value={keyLabel}
              onChange={(e) => setKeyLabel(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="default"
              disabled={!keyLabel.trim() || isSubmitting}
              onClick={async () => {
                try {
                  setIsSubmitting(true);
                  await connectPlainIntegrationAction({
                    environmentId,
                    key: keyLabel.trim(),
                  });
                  toast.success(t("environments.integrations.plain.connection_success"));
                  setOpen(false);
                } catch {
                  toast.error(t("environments.integrations.plain.connection_error"));
                } finally {
                  setIsSubmitting(false);
                }
              }}>
              {t("common.connect")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
