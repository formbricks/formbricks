"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { createContactAttributeKeyAction } from "../actions";
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
import { isSafeIdentifier, toSafeIdentifier } from "@/lib/utils/safe-identifier";
import { getFormattedErrorMessage } from "@/lib/utils/helper";

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
    });
    const [keyError, setKeyError] = useState<string>("");

    const handleResetState = () => {
        setFormData({
            key: "",
            name: "",
            description: "",
        });
        setKeyError("");
        setOpen(false);
    };

    const handleNameChange = (value: string) => {
        setFormData((prev) => {
            const newName = value;
            // Auto-suggest key from name if key is empty or matches previous name suggestion
            let newKey = prev.key;
            if (!prev.key || prev.key === toSafeIdentifier(prev.name)) {
                newKey = toSafeIdentifier(newName);
            }
            return { ...prev, name: newName, key: newKey };
        });
        if (keyError) {
            validateKey(formData.key || toSafeIdentifier(value));
        }
    };

    const handleKeyChange = (value: string) => {
        setFormData((prev) => ({ ...prev, key: value }));
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
        const createContactAttributeKeyResponse = await createContactAttributeKeyAction({
            environmentId,
            key: formData.key,
            name: formData.name || formData.key,
            description: formData.description || undefined,
        });

        if (!createContactAttributeKeyResponse?.data) {
            const errorMessage = getFormattedErrorMessage(createContactAttributeKeyResponse);
            toast.error(errorMessage);
            return;
        }

        toast.success(t("environments.contacts.attribute_created_successfully"));
        handleResetState();
        router.refresh();
        setIsCreating(false);
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
                <DialogContent className="sm:max-w-lg" disableCloseOnOutsideClick>
                    <DialogHeader>
                        <DialogTitle>{t("environments.contacts.create_new_attribute")}</DialogTitle>
                        <DialogDescription>
                            {t("environments.contacts.create_new_attribute_description")}
                        </DialogDescription>
                    </DialogHeader>

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
                                <p className="text-xs text-slate-500">
                                    {t("environments.contacts.attribute_key_hint")}
                                </p>
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

                    <DialogFooter>
                        <Button
                            onClick={() => {
                                handleResetState();
                            }}
                            type="button"
                            variant="secondary">
                            {t("common.cancel")}
                        </Button>
                        <Button disabled={!formData.key || !!keyError} loading={isCreating} onClick={handleCreate} type="submit">
                            {t("environments.contacts.create_key")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

