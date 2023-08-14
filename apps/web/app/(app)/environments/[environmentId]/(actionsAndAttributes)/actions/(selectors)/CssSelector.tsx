import { Input, Switch } from "@formbricks/ui";
import { UseFormRegister } from "react-hook-form";

interface CssSelectorProps {
  isCssSelector: boolean;
  setIsCssSelector: (value: boolean) => void;
  register: UseFormRegister<any>;
}

export const CssSelector = ({ isCssSelector, setIsCssSelector, register }: CssSelectorProps) => {
  return (
    <>
      <div className="mb-6 flex items-center space-x-2">
        <Switch
          id="CSS Selector"
          checked={isCssSelector}
          onCheckedChange={() => {
            setIsCssSelector(!isCssSelector);
          }}
        />
        <div className="ml-4 text-left">
          <div className="text-sm text-slate-900">CSS Selector</div>
          <div className="text-xs text-slate-400">
            If a user clicks a button with a specific CSS class or id
          </div>
        </div>
      </div>
      {isCssSelector && (
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="flex w-full items-end">
            <Input
              type="text"
              placeholder="Add .css-class or #css-id"
              {...register("noCodeConfig.cssSelector.value", { required: true })}
            />
          </div>
        </div>
      )}
    </>
  );
};
