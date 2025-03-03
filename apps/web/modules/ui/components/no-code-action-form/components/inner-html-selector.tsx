"use client";

import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { FormControl, FormField, FormItem } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { useTranslate } from "@tolgee/react";
import { UseFormReturn } from "react-hook-form";
import { TActionClassInput } from "@formbricks/types/action-classes";

interface InnerHtmlSelectorProps {
  form: UseFormReturn<TActionClassInput>;
  disabled: boolean;
}

export const InnerHtmlSelector = ({ form, disabled }: InnerHtmlSelectorProps) => {
  const { watch, control } = form;
  const { t } = useTranslate();
  return (
    <FormField
      control={control}
      name="noCodeConfig.elementSelector.innerHtml"
      render={({ field, fieldState: { error } }) => (
        <FormItem>
          <FormControl>
            <AdvancedOptionToggle
              disabled={disabled}
              htmlId="InnerText"
              isChecked={watch("noCodeConfig.elementSelector.innerHtml") !== undefined}
              onToggle={(checked) => {
                field.onChange(checked ? "" : undefined);
              }}
              title={t("environments.actions.inner_text")}
              description={t("environments.actions.if_a_user_clicks_a_button_with_a_specific_text")}
              childBorder={true}>
              <div className="w-full rounded-lg border border-slate-100 p-4">
                <div className="grid grid-cols-3 gap-x-8">
                  <div className="col-span-3 flex items-end">
                    <Input
                      type="text"
                      disabled={disabled}
                      className="bg-white"
                      placeholder={t("environments.actions.eg_install_app")}
                      {...field}
                      isInvalid={!!error}
                    />
                  </div>
                </div>
              </div>
            </AdvancedOptionToggle>
          </FormControl>
        </FormItem>
      )}
    />
  );
};
