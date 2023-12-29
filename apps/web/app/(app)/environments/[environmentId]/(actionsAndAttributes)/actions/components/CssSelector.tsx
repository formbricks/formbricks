import { UseFormRegister } from "react-hook-form";

import { AdvancedOptionToggle } from "@formbricks/ui/AdvancedOptionToggle";
import { Input } from "@formbricks/ui/Input";

interface CssSelectorProps {
  isCssSelector: boolean;
  setIsCssSelector: (value: boolean) => void;
  register: UseFormRegister<any>;
}

export const CssSelector = ({ isCssSelector, setIsCssSelector, register }: CssSelectorProps) => {
  return (
    <AdvancedOptionToggle
      htmlId="CssSelector"
      isChecked={isCssSelector}
      onToggle={() => {
        setIsCssSelector(!isCssSelector);
      }}
      title="CSS Selector"
      description="If a user clicks a button with a specific CSS class or id"
      childBorder={true}>
      <div className="w-full rounded-lg border border-slate-100 p-4">
        <Input
          type="text"
          className="bg-white"
          placeholder="Add .css-class or #css-id"
          {...register("noCodeConfig.cssSelector.value", { required: isCssSelector })}
        />
      </div>
    </AdvancedOptionToggle>
  );
};
