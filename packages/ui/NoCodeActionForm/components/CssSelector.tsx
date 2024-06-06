import { Control } from "react-hook-form";

import { TActionClassInput } from "@formbricks/types/actionClasses";

import { AdvancedOptionToggle } from "../../AdvancedOptionToggle";
import { FormControl, FormField, FormItem } from "../../Form";
import { Input } from "../../Input";

interface CssSelectorProps {
  isCssSelector: boolean;
  setIsCssSelector: (value: boolean) => void;
  control: Control<TActionClassInput>;
}

export const CssSelector = ({ isCssSelector, setIsCssSelector, control }: CssSelectorProps) => {
  return (
    <FormField
      control={control}
      name="noCodeConfig.elementSelector.cssSelector"
      render={({ field, fieldState: { error } }) => (
        <FormItem>
          <FormControl>
            <AdvancedOptionToggle
              htmlId="CssSelector"
              isChecked={isCssSelector}
              onToggle={() => {
                setIsCssSelector(!isCssSelector);
                field.onChange("");
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
                  required={isCssSelector}
                />
              </div>
            </AdvancedOptionToggle>
          </FormControl>
        </FormItem>
      )}
    />
  );
};
