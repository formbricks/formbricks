import SettingsCard from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import SettingsTitle from "@/app/(app)/environments/[environmentId]/settings/components/SettingsTitle";

import { cn } from "@formbricks/lib/cn";
import { Badge } from "@formbricks/ui/Badge";
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

      <SettingsCard
        title="Theme"
        className="max-w-7xl"
        description="Create a style theme for all surveys. You can enable custom styling for each survey.">
        <div className="flex animate-pulse">
          <div className="w-1/2">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-6">
                  <Switch />
                  <div className="flex flex-col">
                    <h3 className="text-sm font-semibold text-slate-700">Enable custom styling</h3>
                    <p className="text-xs text-slate-500">
                      Allow users to override this theme in the editor.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 bg-slate-50 p-4">
                <div className="w-full rounded-lg border border-slate-300 bg-white">
                  <div className="flex flex-col p-4">
                    <h2 className="text-base font-semibold text-slate-700">Form Styling</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Style the question texts, descriptions and input fields.
                    </p>
                  </div>
                </div>

                <div className="w-full rounded-lg border border-slate-300 bg-white">
                  <div className="flex flex-col p-4">
                    <h2 className="text-base font-semibold text-slate-700">Card Styling</h2>
                    <p className="mt-1 text-sm text-slate-500">Style the survey card.</p>
                  </div>
                </div>

                <div className="w-full rounded-lg border border-slate-300 bg-white">
                  <div className="flex flex-col p-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-700">Background Styling</h2>
                      <Badge text="Link Surveys" type="gray" size="normal" />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Change the background to a color, image or animation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-1/2 bg-slate-100 px-6 pt-4">
            <div className="relative flex h-[95] max-h-[95%] w-full items-center justify-center rounded-lg border border-slate-300 bg-slate-200">
              <div className="flex h-full w-5/6 flex-1 flex-col">
                <div className="flex h-8 w-full items-center rounded-t-lg bg-slate-100">
                  <div className="ml-6 flex space-x-2">
                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                    <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                    <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                  </div>
                  <div className="ml-4 flex w-full justify-between font-mono text-sm text-slate-400">
                    <p>Preview</p>

                    <div className="flex items-center pr-6">Restart</div>
                  </div>
                </div>

                <div className="grid h-[500px] place-items-center bg-white">
                  <h1 className="text-xl font-semibold text-slate-700">Loading preview...</h1>
                </div>
              </div>
            </div>
          </div>
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
