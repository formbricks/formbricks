import { FormControl, FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { useTranslate } from "@tolgee/react";
import { Control } from "react-hook-form";
import { TActionClassInput } from "@formbricks/types/action-classes";

interface ActionNameDescriptionFieldsProps {
  control: Control<TActionClassInput>;
  isReadOnly?: boolean;
  nameInputId?: string;
  descriptionInputId?: string;
}

export const ActionNameDescriptionFields = ({
  control,
  isReadOnly = false,
  nameInputId = "actionNameInput",
  descriptionInputId = "actionDescriptionInput",
}: ActionNameDescriptionFieldsProps) => {
  const { t } = useTranslate();

  return (
    <>
      <div className="grid w-full grid-cols-2 gap-x-4">
        <div className="col-span-1">
          <FormField
            control={control}
            name="name"
            disabled={isReadOnly}
            render={({ field, fieldState: { error } }) => (
              <FormItem>
                <FormLabel htmlFor={nameInputId}>{t("environments.actions.what_did_your_user_do")}</FormLabel>

                <FormControl>
                  <Input
                    type="text"
                    id={nameInputId}
                    {...field}
                    placeholder={t("environments.actions.eg_clicked_download")}
                    isInvalid={!!error?.message}
                    disabled={isReadOnly}
                  />
                </FormControl>

                <FormError />
              </FormItem>
            )}
          />
        </div>

        <div className="col-span-1">
          <FormField
            control={control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor={descriptionInputId}>{t("common.description")}</FormLabel>

                <FormControl>
                  <Input
                    type="text"
                    id={descriptionInputId}
                    {...field}
                    placeholder={t("environments.actions.user_clicked_download_button")}
                    value={field.value ?? ""}
                    disabled={isReadOnly}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </div>

      <hr className="border-slate-200" />
    </>
  );
};
