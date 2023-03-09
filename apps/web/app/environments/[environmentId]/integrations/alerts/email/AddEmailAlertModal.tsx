"use client";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { Fragment } from "react";

type AddEmailAlertModalProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const AddEmailAlertModal: React.FC<AddEmailAlertModalProps> = ({ open, setOpen }) => {
  const surveyNames = ["Survey 1", "Survey 2", "Survey 3", "Survey 4", "Survey 5"];
  const emailRecipients = ["Team Mate 1", "Team Mate 2", "Team Mate 3"];

  const onTest = () => {
    console.log("Test button clicked!");
  };
  const onSave = () => {
    console.log("Save button clicked!");
  };

  return (
    <>
      <Transition.Root show={open} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={setOpen}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0">
            <div className="fixed inset-0 bg-slate-500 bg-opacity-30 backdrop-blur-md transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
                <Dialog.Panel className="relative transform rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                    <button
                      type="button"
                      className="rounded-md bg-white text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-0 focus:ring-offset-2"
                      onClick={() => setOpen(false)}>
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>

                  <h2 className="mb-4 text-2xl font-bold text-slate-700">Add Email Alert</h2>
                  <form>
                    <Label>Alert name</Label>
                    <Input type="text" placeholder="e.g. Product Team Info" />
                    <div className="flex items-center space-x-2">
                      <Checkbox id="all" />
                      <label
                        htmlFor="all"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        All surveys
                      </label>
                    </div>
                    {surveyNames.map((name) => (
                      <div key={name} className="flex items-center space-x-2">
                        <Checkbox id="all" />
                        <label
                          htmlFor="all"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          {name}
                        </label>
                      </div>
                    ))}
                    <Label>Email Recipients</Label>
                    {emailRecipients.map((name) => (
                      <Input key={name} type="email" placeholder={name} />
                    ))}
                    <Button variant="minimal">+ Add member</Button>
                    <div className="flex justify-end space-x-4">
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
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  );
};

/* 
  return (
    <Modal open={isOpen} setOpen={ () => setOpen(false)}>
      <h2 className="mb-4 text-2xl font-bold text-slate-700">Add Email Alert</h2>
      <form>
        <Label>Alert name</Label>
        <Input type="text" placeholder="e.g. Product Team Info" />
        <div className="flex items-center space-x-2">
          <Checkbox id="all" />
          <label
            htmlFor="all"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            All surveys
          </label>
        </div>
        {surveyNames.map((name) => (
          <div key={name} className="flex items-center space-x-2">
            <Checkbox id="all" />
            <label
              htmlFor="all"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {name}
            </label>
          </div>
        ))}
        <Label>Email Recipients</Label>
        {emailRecipients.map((name) => (
          <Input key={name} type="email" placeholder={name} />
        ))}
        <Button variant="minimal">+ Add member</Button>
        <div className="flex justify-end space-x-4">
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
      <Button className="text bg-blue-500 px-4 py-2"></Button>
    </Modal>
  );
}; */

export default AddEmailAlertModal;
