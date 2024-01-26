import SettingsCard from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import SettingsTitle from "@/app/(app)/environments/[environmentId]/settings/components/SettingsTitle";

import { cn } from "@formbricks/lib/cn";
import { Button } from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";
import { RadioGroup, RadioGroupItem } from "@formbricks/ui/RadioGroup";
import { Switch } from "@formbricks/ui/Switch";

const placements = [
  { name: "Bottom Right", value: "bottomRight", disabled: false },
  { name: "Top Right", value: "topRight", disabled: false },
  { name: "Top Left", value: "topLeft", disabled: false },
  { name: "Bottom Left", value: "bottomLeft", disabled: false },
  { name: "Centered Modal", value: "center", disabled: false },
];

export default function Loading() {
  return (
    <div>
      <SettingsTitle title="Look & Feel" />
      <SettingsCard title="Brand Color" description="Match the surveys with your user interface.">
        <div className="w-full max-w-sm items-center">
          <Label htmlFor="brandcolor">Color (HEX)</Label>
          <div className="my-2">
            <div className="flex w-full items-center justify-between space-x-1 rounded-md border border-slate-300 px-2 text-sm text-slate-400">
              <div className="ml-2 mr-2 h-10 w-32 border-0 bg-transparent text-slate-500 outline-none focus:border-none"></div>
            </div>
          </div>
          <Button
            variant="darkCTA"
            className="pointer-events-none mt-4 animate-pulse cursor-not-allowed select-none bg-slate-200">
            Loading
          </Button>
        </div>
      </SettingsCard>
      <SettingsCard
        title="In-app Survey Placement"
        description="Change where surveys will be shown in your web app.">
        <div className="w-full items-center">
          <div className="flex cursor-not-allowed select-none">
            <RadioGroup>
              {placements.map((placement) => (
                <div key={placement.value} className="flex items-center space-x-2 whitespace-nowrap ">
                  <RadioGroupItem
                    className="cursor-not-allowed select-none"
                    id={placement.value}
                    value={placement.value}
                    disabled={placement.disabled}
                  />
                  <Label
                    htmlFor={placement.value}
                    className={cn(
                      placement.disabled ? "cursor-not-allowed text-slate-500" : "text-slate-900"
                    )}>
                    {placement.name}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <div className="relative ml-8 h-40 w-full rounded bg-slate-200">
              <div className={cn("absolute bottom-3 h-16 w-16 rounded bg-slate-700 sm:right-3")}></div>
            </div>
          </div>
          <Button
            variant="darkCTA"
            className="pointer-events-none mt-4 animate-pulse cursor-not-allowed select-none bg-slate-200">
            Loading
          </Button>
        </div>
      </SettingsCard>
      <SettingsCard
        noPadding
        title="Highlight Border"
        description="Make sure your users notice the survey you display">
        <div className="flex min-h-full w-full">
          <div className="flex w-1/2 flex-col px-6 py-5">
            <div className="pointer-events-none mb-6 flex cursor-not-allowed select-none items-center space-x-2">
              <Switch id="highlightBorder" checked={false} />
              <h2 className="text-sm font-medium text-slate-800">Show highlight border</h2>
            </div>

            <Button
              type="submit"
              variant="darkCTA"
              className="pointer-events-none mt-4 flex max-w-[100px] animate-pulse cursor-not-allowed select-none items-center justify-center">
              Loading
            </Button>
          </div>

          <div className="flex w-1/2 flex-col items-center justify-center gap-4 bg-slate-200 px-6 py-5">
            <h3 className="text-slate-500">Preview</h3>
            <div className={cn("flex flex-col gap-4 rounded-lg border-2 bg-white p-5")}>
              <h3 className="text-sm font-semibold text-slate-800">How easy was it for you to do this?</h3>
              <div className="flex rounded-2xl border border-slate-400">
                {[1, 2, 3, 4, 5].map((num) => (
                  <div key={num} className="border-r border-slate-400 px-6 py-5 last:border-r-0">
                    <span className="text-sm font-medium">{num}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SettingsCard>
      <SettingsCard
        title="Formbricks Signature"
        description="We love your support but understand if you toggle it off.">
        <div className="w-full items-center">
          <div className="pointer-events-none flex cursor-not-allowed select-none items-center space-x-2">
            <Switch id="signature" checked={false} />
            <Label htmlFor="signature">Show &apos;Powered by Formbricks&apos; Signature</Label>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
