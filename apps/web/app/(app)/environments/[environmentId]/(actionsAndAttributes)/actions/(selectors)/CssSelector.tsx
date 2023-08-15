import { AdvancedOptionToggle, Input } from "@formbricks/ui";
import { UseFormRegister } from "react-hook-form";

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
      description="If a user clicks a button with a specific CSS class or id">
      <div className="w-full rounded-lg border border-slate-100 bg-slate-50 p-4">
        <div className="flex items-end">
          <Input
            type="text"
            placeholder="Add .css-class or #css-id"
            {...register("noCodeConfig.cssSelector.value", { required: true })}
          />
        </div>
      </div>
    </AdvancedOptionToggle>
  );
};
