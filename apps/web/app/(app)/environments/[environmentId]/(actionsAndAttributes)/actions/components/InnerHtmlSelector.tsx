import { AdvancedOptionToggle } from "@formbricks/ui/AdvancedOptionToggle";
import { Input } from "@formbricks/ui/Input";
import { UseFormRegister } from "react-hook-form";

interface InnerHtmlSelectorProps {
  isInnerHtml: boolean;
  setIsInnerHtml: (value: boolean) => void;
  register: UseFormRegister<any>;
}

export const InnerHtmlSelector = ({ isInnerHtml, setIsInnerHtml, register }: InnerHtmlSelectorProps) => {
  return (
    <AdvancedOptionToggle
      htmlId="InnerText"
      isChecked={isInnerHtml}
      onToggle={() => {
        setIsInnerHtml(!isInnerHtml);
      }}
      title="Inner Text"
      description="If a user clicks a button with a specific text"
      childBorder={true}>
      <div className="w-full rounded-lg border border-slate-100  p-4">
        <div className="grid grid-cols-3 gap-x-8">
          <div className="col-span-3 flex items-end">
            <Input
              type="text"
              className="bg-white"
              placeholder="e.g. 'Install App'"
              {...register("noCodeConfig.innerHtml.value", { required: isInnerHtml })}
            />
          </div>
        </div>
      </div>
    </AdvancedOptionToggle>
  );
};
