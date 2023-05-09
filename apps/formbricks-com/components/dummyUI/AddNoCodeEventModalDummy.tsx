import Modal from "../shared/Modal";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { RadioGroup, RadioGroupItem } from "@formbricks/ui/RadioGroup";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui/Select";
import { CursorArrowRaysIcon } from "@heroicons/react/24/solid";

interface EventDetailModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export const AddNoCodeEventModalDummy: React.FC<EventDetailModalProps> = ({ open, setOpen }) => {
  return (
    <Modal open={open} setOpen={setOpen} noPadding>
      <div className="flex h-full flex-col rounded-lg bg-slate-50 dark:bg-slate-800">
        <div className="rounded-t-lg bg-slate-100 dark:bg-slate-700">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <CursorArrowRaysIcon />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700 dark:text-slate-300">Add Action</div>
                <div className="text-sm text-slate-500">
                  Create a new user action to display surveys when it&apos;s triggered.
                </div>
              </div>
            </div>
          </div>
        </div>
        <form>
          <div className="flex justify-between rounded-lg p-6">
            <div className="space-y-4">
              <div>
                <Label>Select By</Label>
                <RadioGroup className="grid grid-cols-2 gap-1 md:grid-cols-3" defaultValue="pageUrl">
                  <div className="flex items-center space-x-2 rounded-lg border border-slate-200 p-3 dark:border-slate-500">
                    <RadioGroupItem value="pageUrl" id="pageUrl" className="bg-slate-50" />
                    <Label htmlFor="pageUrl" className="cursor-pointer dark:text-slate-200">
                      Page URL
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-600">
                    <RadioGroupItem disabled value="innerHtml" id="innerHtml" className="bg-slate-50" />
                    <Label
                      htmlFor="innerHtml"
                      className="flex cursor-not-allowed items-center text-slate-500 dark:text-slate-400">
                      Inner Text
                    </Label>
                  </div>
                  <div className="hidden items-center space-x-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-600 md:flex">
                    <RadioGroupItem disabled value="cssSelector" id="cssSelector" className="bg-slate-50" />
                    <Label
                      htmlFor="cssSelector"
                      className="flex cursor-not-allowed items-center text-slate-500">
                      CSS Selector
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="grid grid-cols-2 gap-x-2">
                <div>
                  <Label>Name</Label>
                  <Input placeholder="e.g. Dashboard Page View" defaultValue="Dashboard view" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input placeholder="e.g. User visited dashboard" defaultValue="User visited dashboard" />
                </div>
              </div>
              <div className="grid w-full grid-cols-3 gap-x-8">
                <div className="col-span-1">
                  <Label>URL</Label>
                  <Select defaultValue="endsWith">
                    <SelectTrigger
                      className="w-[110px] dark:text-slate-200 md:w-[180px]"
                      onClick={(e) => e.preventDefault()}
                      disabled>
                      <SelectValue placeholder="Select match type" />
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
                  <Input type="text" defaultValue="/dashboard" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-200 p-6 dark:border-slate-700">
            <div className="flex space-x-2">
              <Button
                variant="minimal"
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                }}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                }}>
                Add event
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default AddNoCodeEventModalDummy;
