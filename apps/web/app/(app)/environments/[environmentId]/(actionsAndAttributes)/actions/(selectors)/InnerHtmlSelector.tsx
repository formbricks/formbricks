import { Switch, Input } from "@formbricks/ui";
import { UseFormRegister } from "react-hook-form";

interface InnerHtmlSelectorProps {
  isInnerHtml: boolean;
  setIsInnerHtml: (value: boolean) => void;
  register: UseFormRegister<any>;
}

export const InnerHtmlSelector = ({ isInnerHtml, setIsInnerHtml, register }: InnerHtmlSelectorProps) => {
  return (
    <>
      <div className="mb-6 flex items-center space-x-2">
        <Switch
          id="Inner Text"
          checked={isInnerHtml}
          onCheckedChange={() => {
            setIsInnerHtml(!isInnerHtml);
          }}
        />
        <div className="ml-4 text-left">
          <div className="text-sm text-slate-900">Inner Text</div>
          <div className="text-xs text-slate-400">If a user clicks a button with a specific text</div>
        </div>
      </div>
      {isInnerHtml && (
        <div className="col-span-1 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="grid w-full grid-cols-3 gap-x-8">
            <div className="col-span-3 flex w-full items-end">
              <Input
                type="text"
                placeholder="e.g. 'Install App'"
                {...register("noCodeConfig.innerHtml.value", { required: true })}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
