"use client";

import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Modal } from "@/modules/ui/components/modal";
import { useTranslate } from "@tolgee/react";
import { KeyIcon } from "lucide-react";
import { useState } from "react";

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

  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalSetOpen || setInternalOpen;

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false} restrictOverflow>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <KeyIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">
                  {t("environments.integrations.plain.add_key")}
                </div>
                <div className="text-sm text-slate-500">
                  {t("environments.integrations.plain.add_key_description")}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <label htmlFor="keyLabel" className="mb-2 block text-sm font-medium text-slate-700">
              {t("environments.integrations.plain.api_key_label")}
            </label>
            <Input
              id="keyLabel"
              name="keyLabel"
              placeholder={t("environments.integrations.plain.api_key_label_placeholder")}
              value={keyLabel}
              onChange={(e) => setKeyLabel(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="default" disabled={!keyLabel.trim()}>
              {t("common.connect")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
