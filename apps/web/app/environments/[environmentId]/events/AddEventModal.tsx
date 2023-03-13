import Modal from "@/components/shared/Modal";
import { CodeBracketIcon, CursorArrowRaysIcon, SparklesIcon } from "@heroicons/react/24/solid";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";

interface EventDetailModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export default function EventDetailModal({ open, setOpen }: EventDetailModalProps) {
  const createEvent = () => {
    console.log("Save changes");
    setOpen(false);
  };

  return (
    <Modal open={open} setOpen={setOpen} noPadding>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              {/* 
              {icon && <div className="mr-1.5 h-6 w-6 text-slate-500">{icon}</div>} */}
              <div>
                <div className="text-xl font-medium text-slate-700">Create Event</div>
                <div className="text-sm text-slate-500">
                  Create a new event to filter your user base with.
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-between rounded-lg p-6">
          <div>
            <form className="space-y-4">
              <Label>Event Type</Label>
              <Label>Select By</Label>
              <div className="grid grid-cols-2 gap-x-2">
                <div>
                  <Label>Name</Label>
                  <Input placeholder="e.g. Dashboard Page View" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input placeholder="e.g. User visited dashboard" />
                </div>
              </div>
              <div className="grid w-full grid-cols-3 gap-x-8">
                <div className="col-span-1">
                  <Label>URL</Label>
                  <Select>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Match type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exactMatch">Exactly matches</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="startsWith">Starts with</SelectItem>
                      <SelectItem value="endsWith">Ends with</SelectItem>
                      <SelectItem value="notMatch">Does not exactly match</SelectItem>
                      <SelectItem value="notContains">Does not contain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 flex w-full items-end">
                  <Input placeholder="e.g. https://app.formbricks.com/dashboard" />
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Test Your URL</Label>
                <div className=" rounded bg-slate-50 p-4">
                  <Label className="font-normal text-slate-500">
                    Enter a URL to see if it matches your event URL
                  </Label>
                  <div className="mt-1 flex">
                    <Input
                      className="bg-white"
                      placeholder="Paste the URL you want the event to trigger on"
                    />
                    <Button className="ml-2 whitespace-nowrap">Test Match</Button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-200 p-6">
          <div className="flex space-x-2">
            <Button
              variant="minimal"
              onClick={() => {
                setOpen(false);
              }}>
              Cancel
            </Button>
            <Button variant="primary">Create event</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
