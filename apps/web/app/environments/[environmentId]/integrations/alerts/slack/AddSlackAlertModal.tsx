"use client";

import Modal from "@/components/shared/Modal";
import { Button, Checkbox, Input, Label } from "@formbricks/ui";

type AddEmailAlertModalProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const AddEmailAlertModal: React.FC<AddEmailAlertModalProps> = ({ open, setOpen }) => {
  const surveys = [
    { label: "Survey 1", id: "1" },
    { label: "Survey 2", id: "2" },
    { label: "Survey 3", id: "3" },
  ];

  const onTest = () => {
    throw Error("not implemented");
  };
  const onSave = () => {
    throw Error("not implemented");
  };

  return (
    <>
      <Modal open={open} setOpen={setOpen} title="Add Slack Alert">
        <form className="space-y-6">
          <div>
            <Label>Alert name</Label>
            <Input type="text" placeholder="e.g. Product Team Info" />
          </div>
          <div>
            <Label>End Point URL</Label>
            <Input type="URL" placeholder="https://hooks.slack.com/service/ABC123/ASD213ADS" />
          </div>
          <div>
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

          <div className="flex justify-end space-x-2">
            <Button variant="minimal" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={onTest}>
              Send Test
            </Button>
            <Button variant="darkCTA" onClick={onSave}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default AddEmailAlertModal;
