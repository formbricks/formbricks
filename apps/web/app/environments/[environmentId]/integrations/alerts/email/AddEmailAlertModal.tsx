"use client";

import Modal from "@/components/shared/Modal";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

type AddEmailAlertModalProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const AddEmailAlertModal: React.FC<AddEmailAlertModalProps> = ({ open, setOpen }) => {
  const surveys = [
    { label: "Survey 1", id: "1" },
    { label: "Survey 1", id: "1" },
    { label: "Survey 1", id: "1" },
  ];
  const emailRecipients = ["Team Mate 1", "Team Mate 2", "Team Mate 3"];

  const onTest = () => {
    console.log("Test button clicked!");
  };
  const onSave = () => {
    console.log("Save button clicked!");
  };

  return (
    <>
      <Modal open={open} setOpen={setOpen} title="Add Email Alert">
        <form>
          <div className="">
            <Label>Alert name</Label>
            <Input type="text" placeholder="e.g. Product Team Info" />
          </div>
          <div className="my-6">
            <Label className="block">Trigger Event</Label>
            <Label className="font-normal text-slate-400">
              Send message every time one of the surveys receives a response:
            </Label>
            <div className="mt-2 rounded bg-slate-50 p-6 ">
              <div className="flex items-center space-x-2">
                <Checkbox id="all" />
                <label
                  htmlFor="all"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  All surveys
                </label>
              </div>
              <hr className="my-2" />
              {surveys.map((survey) => (
                <div key={survey.id} className="flex items-center space-x-2">
                  <Checkbox className="my-1" id={survey.id} />
                  <label
                    htmlFor="all"
                    className="text-sm font-medium leading-none text-slate-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {survey.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <Label>Email Recipients</Label>
          {emailRecipients.map((name) => (
            <Input key={name} type="email" placeholder={name} />
          ))}
          <Button variant="minimal">+ Add member</Button>
          <div className="flex justify-end space-x-2">
            <Button variant="minimal" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={onTest}>
              Send Test
            </Button>
            <Button variant="primary" onClick={onSave}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default AddEmailAlertModal;
