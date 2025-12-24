"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { CreateAttributeKeyModal } from "./create-attribute-key-modal";

interface CreateAttributeKeyButtonProps {
  environmentId: string;
}

export function CreateAttributeKeyButton({ environmentId }: CreateAttributeKeyButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        {t("environments.contacts.create_attribute")}
        <PlusIcon className="h-4 w-4" />
      </Button>
      <CreateAttributeKeyModal environmentId={environmentId} open={open} setOpen={setOpen} />
    </>
  );
}
