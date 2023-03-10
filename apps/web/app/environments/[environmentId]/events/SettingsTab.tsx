import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { RadioGroup, RadioGroupItem } from "@radix-ui/react-radio-group";
import type { EventClass } from "@prisma/client";

interface SettingsTabProps {
  eventClass: EventClass;
}

export default function SettingsTab({ eventClass }: SettingsTabProps) {
  return (
    <div>
      <form className="space-y-4">
        <div className="">
          <Label className="text-slate-600">Display name</Label>
          <Input type="text" placeholder="e.g. Product Team Info" defaultValue={eventClass.name} />
        </div>
        <div className="">
          <Label className="text-slate-600">Display description</Label>
          <Input
            type="text"
            placeholder="e.g. Triggers when user changed subscription"
            defaultValue={eventClass.description || ""}
          />
        </div>
        <div className="my-6">
          <Label className="block text-slate-600">Event Type</Label>
          <Label className="font-normal text-slate-400">
            There are three ways to trigger and event. Choose which type this is:
          </Label>
          <div className="mt-2 rounded bg-slate-50 p-6 ">
            <div className="">
              <RadioGroup className="flex items-center">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Page URL" id={eventClass.id} />
                  <Label htmlFor={eventClass.id}>Page URL</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Inner Text" id={eventClass.id} />
                  <Label htmlFor={eventClass.id}>Inner Text</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CSS Selector" id={eventClass.id} />
                  <Label htmlFor={eventClass.id}>CSS Selector</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
