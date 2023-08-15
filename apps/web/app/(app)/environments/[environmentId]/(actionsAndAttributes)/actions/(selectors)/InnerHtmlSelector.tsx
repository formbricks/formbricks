import { Input, AdvancedOptionToggle } from "@formbricks/ui";
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
      description="If a user clicks a button with a specific text">
      <div className="col-span-1 w-full space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
        <div className="grid grid-cols-3 gap-x-8">
          <div className="col-span-3 flex items-end">
            <Input
              type="text"
              placeholder="e.g. 'Install App'"
              {...register("noCodeConfig.innerHtml.value", { required: isInnerHtml })}
            />
          </div>
        </div>
      </div>
    </AdvancedOptionToggle>
  );
};
