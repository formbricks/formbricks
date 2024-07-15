import { UseFormReturn } from "react-hook-form";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { AdvancedOptionToggle } from "../../../AdvancedOptionToggle";
import { FormControl, FormField, FormItem } from "../../../Form";
import { Input } from "../../../Input";

interface InnerHtmlSelectorProps {
  form: UseFormReturn<TActionClassInput>;
}

export const InnerHtmlSelector = ({ form }: InnerHtmlSelectorProps) => {
  const { watch, control } = form;
  return (
    <FormField
      control={control}
      name="noCodeConfig.elementSelector.innerHtml"
      render={({ field, fieldState: { error } }) => (
        <FormItem>
          <FormControl>
            <AdvancedOptionToggle
              htmlId="InnerText"
              isChecked={watch("noCodeConfig.elementSelector.innerHtml") !== undefined}
              onToggle={(checked) => {
                field.onChange(checked ? "" : undefined);
              }}
              title="Inner Text"
              description="If a user clicks a button with a specific text"
              childBorder={true}>
              <div className="w-full rounded-lg border border-slate-100 p-4">
                <div className="grid grid-cols-3 gap-x-8">
                  <div className="col-span-3 flex items-end">
                    <Input
                      type="text"
                      className="bg-white"
                      placeholder="e.g. 'Install App'"
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
