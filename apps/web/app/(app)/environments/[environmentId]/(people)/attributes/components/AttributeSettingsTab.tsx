"use client";

import type { AttributeClass } from "@prisma/client";
import { ArchiveIcon, ArchiveXIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { updateAttributeClass } from "@formbricks/lib/attributeClass/service";
import { Button } from "@formbricks/ui/components/Button";
import { Input } from "@formbricks/ui/components/Input";
import { Label } from "@formbricks/ui/components/Label";

interface AttributeSettingsTabProps {
  attributeClass: AttributeClass;
  setOpen: (v: boolean) => void;
}

export const AttributeSettingsTab = async ({ attributeClass, setOpen }: AttributeSettingsTabProps) => {
  const router = useRouter();
  const t = useTranslations();
  const { register, handleSubmit } = useForm({
    defaultValues: { name: attributeClass.name, description: attributeClass.description },
  });
  const [isAttributeBeingSubmitted, setisAttributeBeingSubmitted] = useState(false);

  const onSubmit = async (data) => {
    setisAttributeBeingSubmitted(true);
    setOpen(false);
    await updateAttributeClass(attributeClass.id, data);
    router.refresh();
    setisAttributeBeingSubmitted(false);
  };

  const handleArchiveToggle = async () => {
    setisAttributeBeingSubmitted(true);
    const data = { archived: !attributeClass.archived };
    await updateAttributeClass(attributeClass.id, data);
    setisAttributeBeingSubmitted(false);
  };

  return (
    <div>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Label className="text-slate-600">{t("common.name")}</Label>
          <Input
            type="text"
            placeholder={t("environments.attributes.ex_user_property")}
            {...register("name", {
              disabled: attributeClass.type === "automatic" || attributeClass.type === "code" ? true : false,
            })}
          />
        </div>
        <div>
          <Label className="text-slate-600">{t("common.description")}</Label>
          <Input
            type="text"
            placeholder={t("environments.attributes.ex_user_property")}
            {...register("description", {
              disabled: attributeClass.type === "automatic" ? true : false,
            })}
          />
        </div>
        <div className="my-6">
          <Label>{t("common.attribute_type")}</Label>
          {attributeClass.type === "code" ? (
            <p className="text-sm text-slate-600">
              {t("environments.attributes.this_is_a_code_attribute_you_can_only_change_the_description")}
            </p>
          ) : attributeClass.type === "automatic" ? (
            <p className="text-sm text-slate-600">
              {t(
                "environments.attributes.this_attribute_was_added_automatically_you_cannot_make_changes_to_it"
              )}
            </p>
          ) : null}
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-6">
          <div className="flex items-center">
            <Button
              variant="secondary"
              href="https://formbricks.com/docs/attributes/identify-users"
              target="_blank">
              {t("common.read_docs")}
            </Button>
            {attributeClass.type !== "automatic" && (
              <Button className="ml-3" variant="secondary" onClick={handleArchiveToggle}>
                {attributeClass.archived ? (
                  <>
                    {" "}
                    <ArchiveXIcon className="mr-2 h-4 text-slate-600" />
                    <span>{t("common.unarchive")}</span>
                  </>
                ) : (
                  <>
                    {" "}
                    <ArchiveIcon className="mr-2 h-4 text-slate-600" />
                    <span>{t("common.archive")}</span>
                  </>
                )}
              </Button>
            )}
          </div>
          {attributeClass.type !== "automatic" && (
            <div className="flex space-x-2">
              <Button type="submit" loading={isAttributeBeingSubmitted}>
                {t("common.save_changes")}
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
