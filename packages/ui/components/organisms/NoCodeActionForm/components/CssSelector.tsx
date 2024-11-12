import { useTranslations } from "next-intl";
import { UseFormReturn } from "react-hook-form";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { AdvancedOptionToggle } from "../../../AdvancedOptionToggle";
import { FormControl, FormField, FormItem } from "../../../Form";
import { Input } from "../../../Input";

interface CssSelectorProps {
  form: UseFormReturn<TActionClassInput>;
  disabled: boolean;
}

export const CssSelector = ({ form, disabled }: CssSelectorProps) => {
  const { watch, control } = form;
  const t = useTranslations();
  return (
    <FormField
      control={control}
      name="noCodeConfig.elementSelector.cssSelector"
      render={({ field, fieldState: { error } }) => (
        <FormItem>
          <FormControl>
            <AdvancedOptionToggle
              disabled={disabled}
              htmlId="CssSelector"
              isChecked={watch("noCodeConfig.elementSelector.cssSelector") !== undefined}
              onToggle={(checked) => {
                field.onChange(checked ? "" : undefined);
              }}
              title={t("environments.actions.css_selector")}
              description={t(
                "environments.actions.if_a_user_clicks_a_button_with_a_specific_css_class_or_id"
              )}
              childBorder={true}>
              <div className="w-full rounded-lg border border-slate-100 p-4">
                <Input
                  type="text"
                  className="bg-white"
                  disabled={disabled}
                  placeholder={t("environments.actions.add_css_class_or_id")}
                  {...field}
                  isInvalid={!!error}
                />
              </div>
            </AdvancedOptionToggle>
          </FormControl>
        </FormItem>
      )}
    />
  );
};
