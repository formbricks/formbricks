import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import type { EventClass } from "@prisma/client";

interface EventSettingsTabProps {
  eventClass: EventClass;
}

export default function EventSettingsTab({ eventClass }: EventSettingsTabProps) {
  return (
    <div>
      <form className="space-y-4">
        <div className="">
          <Label className="text-slate-600">Display name</Label>
          <Input
            type="text"
            placeholder="e.g. Product Team Info"
            defaultValue={eventClass.name}
            disabled={eventClass.type === "automatic" || "code" ? true : false}
          />
        </div>
        <div className="">
          <Label className="text-slate-600">Display description</Label>
          <Input
            type="text"
            placeholder="e.g. Triggers when user changed subscription"
            defaultValue={eventClass.description || ""}
            disabled={eventClass.type === "automatic" ? true : false}
          />
        </div>
        <div className="my-6">
          <Label>Event Type</Label>
          {eventClass.type === "code" ? (
            <p className="text-sm text-slate-600">
              This is a code event. Please make changes in your code base.
            </p>
          ) : eventClass.type === "noCode" ? (
            <div>
              <Label className="mb-3 mt-1 block font-normal text-slate-500">
                You cannot change the event type. Please add a new event instead.
              </Label>
              <RadioGroup defaultValue="page-url" className="flex">
                <div className="flex items-center space-x-2 rounded-lg  bg-slate-50 p-3">
                  <RadioGroupItem disabled checked value="page-url" id="page-url" className="bg-slate-50" />
                  <Label htmlFor="page-url" className="flex items-center text-slate-400">
                    Page URL
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-lg bg-slate-50 p-3">
                  <RadioGroupItem disabled value="inner-html" id="inner-html" className="bg-slate-50" />
                  <Label htmlFor="inner-html" className="flex items-center text-slate-400">
                    Inner Text
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-lg bg-slate-50 p-3">
                  <RadioGroupItem disabled value="css-selector" id="css-selector" className="bg-slate-50" />
                  <Label htmlFor="css-selector" className="flex items-center text-slate-400">
                    CSS Selector
                  </Label>
                </div>
              </RadioGroup>
            </div>
          ) : eventClass.type === "automatic" ? (
            <p className="text-sm text-slate-600">
              This event was created automatically. You cannot make changes to it.
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
