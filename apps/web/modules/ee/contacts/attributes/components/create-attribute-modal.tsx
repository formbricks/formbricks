"use client";

import { Calendar1Icon, HashIcon, PlusIcon, TagIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { formatSnakeCaseToTitleCase, isSafeIdentifier } from "@/lib/utils/safe-identifier";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { createContactAttributeKeyAction } from "../actions";

interface CreateAttributeModalProps {
  environmentId: string;
}

export function CreateAttributeModal({ environmentId }: Readonly<CreateAttributeModalProps>) {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    key: "",
    name: "",
    description: "",
    dataType: "string" as TContactAttributeDataType,
  });
  const [keyError, setKeyError] = useState<string>("");

  const handleResetState = () => {
    setFormData({
      key: "",
      name: "",
      description: "",
      dataType: "string",
    });
    setKeyError("");
    setOpen(false);
  };

  const handleNameChange = (value: string) => {
    setFormData((prev) => ({ ...prev, name: value }));
    if (keyError && formData.key) {
      validateKey(formData.key);
    }
  };

  const handleKeyChange = (value: string) => {
    const previousAutoLabel = formData.key ? formatSnakeCaseToTitleCase(formData.key) : "";
    const newAutoLabel = value ? formatSnakeCaseToTitleCase(value) : "";

    setFormData((prev) => {
      // Auto-update name if it's empty or matches the previous auto-generated label
      const shouldAutoUpdateName = !prev.name || prev.name === previousAutoLabel;
      return {
        ...prev,
        key: value,
        name: shouldAutoUpdateName ? newAutoLabel : prev.name,
      };
    });
    validateKey(value);
  };

  const validateKey = (key: string) => {
    if (!key) {
      setKeyError(t("environments.contacts.attribute_key_required"));
      return false;
    }
    if (!isSafeIdentifier(key)) {
      setKeyError(
        t("environments.contacts.attribute_key_safe_identifier_required") ||
          "Key must be a safe identifier: only lowercase letters, numbers, and underscores, and must start with a letter"
      );
      return false;
    }
    setKeyError("");
    return true;
  };

  const handleCreate = async () => {
    if (!formData.key) {
      setKeyError(t("environments.contacts.attribute_key_required"));
      return;
    }

    if (!validateKey(formData.key)) {
      return;
    }

    setIsCreating(true);

    try {
      const createContactAttributeKeyResponse = await createContactAttributeKeyAction({
        environmentId,
        key: formData.key,
        name: formData.name || formatSnakeCaseToTitleCase(formData.key),
        description: formData.description || undefined,
        dataType: formData.dataType,
      });

      if (!createContactAttributeKeyResponse?.data) {
        const errorMessage = getFormattedErrorMessage(createContactAttributeKeyResponse);
        toast.error(errorMessage);
        return;
      }

      toast.success(t("environments.contacts.attribute_created_successfully"));
      handleResetState();
      router.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("common.something_went_wrong");
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await handleCreate();
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        {t("environments.contacts.create_attribute")}
        <PlusIcon />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(open) => {
          if (!open) {
            handleResetState();
          }
        }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("environments.contacts.create_new_attribute")}</DialogTitle>
            <DialogDescription>
              {t("environments.contacts.create_new_attribute_description")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <DialogBody>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-900">
                    {t("environments.contacts.attribute_key")}
                  </label>
                  <Input
                    value={formData.key}
                    onChange={(e) => handleKeyChange(e.target.value)}
                    placeholder={t("environments.contacts.attribute_key_placeholder")}
                    className={keyError ? "border-red-500" : ""}
                  />
                  {keyError && <p className="text-sm text-red-500">{keyError}</p>}
                  <p className="text-xs text-slate-500">{t("environments.contacts.attribute_key_hint")}</p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-900">
                    {t("environments.contacts.attribute_label")}
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder={t("environments.contacts.attribute_label_placeholder")}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-900">
                    {t("environments.contacts.data_type")}
                  </label>
                  <Select
                    value={formData.dataType}
                    onValueChange={(value: TContactAttributeDataType) =>
                      setFormData((prev) => ({ ...prev, dataType: value }))
                    }>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">
                        <div className="flex items-center gap-2">
                          <TagIcon className="h-4 w-4" />
                          <span>{t("common.string")}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="number">
                        <div className="flex items-center gap-2">
                          <HashIcon className="h-4 w-4" />
                          <span>{t("common.number")}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="date">
                        <div className="flex items-center gap-2">
                          <Calendar1Icon className="h-4 w-4" />
                          <span>{t("common.date")}</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">{t("environments.contacts.data_type_description")}</p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-900">
                    {t("environments.contacts.attribute_description")} ({t("common.optional")})
                  </label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder={t("environments.contacts.attribute_description_placeholder")}
                  />
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="mt-4">
              <Button
                onClick={() => {
                  handleResetState();
                }}
                type="button"
                variant="secondary">
                {t("common.cancel")}
              </Button>
              <Button
                disabled={!formData.key || !formData.name || !!keyError}
                loading={isCreating}
                type="submit">
                {t("environments.contacts.create_attribute")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
