import { UseFormReturn } from "react-hook-form";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { AdvancedOptionToggle } from "../../../AdvancedOptionToggle";
import { FormControl, FormField, FormItem } from "../../../Form";
import { Input } from "../../../Input";

interface CssSelectorProps {
  form: UseFormReturn<TActionClassInput>;
}

export const CssSelector = ({ form }: CssSelectorProps) => {
  const { watch, control } = form;
  return (
    <FormField
      control={control}
      name="noCodeConfig.elementSelector.cssSelector"
      render={({ field, fieldState: { error } }) => (
        <FormItem>
          <FormControl>
            <AdvancedOptionToggle
              htmlId="CssSelector"
              isChecked={watch("noCodeConfig.elementSelector.cssSelector") !== undefined}
              onToggle={(checked) => {
                field.onChange(checked ? "" : undefined);
              }}
              title="CSS Selector"
              description="If a user clicks a button with a specific CSS class or id"
              childBorder={true}>
              <div className="w-full rounded-lg border border-slate-100 p-4">
                <Input
                  type="text"
                  className="bg-white"
                  placeholder="Add .css-class or #css-id"
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
