import {
  AdvancedOptionToggle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formbricks/ui";
import { Label } from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import { Control, Controller, UseFormRegister } from "react-hook-form";

interface PageUrlSelectorProps {
  isPageUrl: boolean;
  setIsPageUrl: (value: boolean) => void;
  testUrl: string;
  setTestUrl: (value: string) => void;
  isMatch: string;
  setIsMatch: (value: string) => void;
  handleMatchClick: () => void;
  control: Control<any>;
  register: UseFormRegister<any>;
}

export const PageUrlSelector = ({
  isPageUrl,
  setIsPageUrl,
  control,
  register,
  testUrl,
  isMatch,
  setIsMatch,
  setTestUrl,
  handleMatchClick,
}: PageUrlSelectorProps) => {
  return (
    <AdvancedOptionToggle
      htmlId="PageURL"
      isChecked={isPageUrl}
      onToggle={() => {
        setIsPageUrl(!isPageUrl);
      }}
      title="Page URL"
      description="If a user visits a specific URL">
      <div className="col-span-1 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
        <div className="grid w-full grid-cols-3 gap-x-8">
          <div className="col-span-1">
            <Label>URL</Label>
            <Controller
              name="noCodeConfig.pageUrl.rule"
              defaultValue={"exactMatch"}
              control={control}
              render={({ field: { onChange, value } }) => (
                <Select onValueChange={onChange} {...value}>
                  <SelectTrigger className="w-[175px] bg-white">
                    <SelectValue placeholder="Select match type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="exactMatch">Exactly matches</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="startsWith">Starts with</SelectItem>
                    <SelectItem value="endsWith">Ends with</SelectItem>
                    <SelectItem value="notMatch">Does not exactly match</SelectItem>
                    <SelectItem value="notContains">Does not contain</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="col-span-2 flex w-full items-end">
            <Input
              type="text"
              placeholder="e.g. https://app.com/dashboard"
              {...register("noCodeConfig.[pageUrl].value", { required: isPageUrl })}
            />
          </div>
        </div>
        <div className="pt-4">
          <div className="text-sm text-slate-900">Test your URL</div>
          <div className="text-xs text-slate-400">
            Enter a URL to see if a user visiting it would be tracked.
          </div>
          <div className=" rounded bg-slate-50">
            <div className="mt-1 flex">
              <Input
                type="text"
                value={testUrl}
                onChange={(e) => {
                  setTestUrl(e.target.value);
                  setIsMatch("default");
                }}
                className={clsx(
                  isMatch === "yes"
                    ? "border-green-500 bg-green-50"
                    : isMatch === "no"
                    ? "border-red-200 bg-red-50"
                    : isMatch === "default"
                    ? "border-slate-200"
                    : "bg-white"
                )}
                placeholder="e.g. https://app.com/dashboard"
              />
              <Button
                type="button"
                variant="secondary"
                className="ml-2 whitespace-nowrap"
                onClick={() => {
                  handleMatchClick();
                }}>
                Test Match
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdvancedOptionToggle>
  );
};
