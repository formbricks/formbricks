"use client";
import { Button, Input } from "@/../../packages/ui";
import { useState } from "react";
import Headline from "../preview/Headline";
import Modal from "../shared/Modal";

const OnboardingModal = () => {
  const [open, setOpen] = useState(true);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#334155");

  const handleNameChange = (event) => {
    setName(event.target.value);
  };

  const handleColorChange = (event) => {
    setColor(event.target.value);
  };

  const dummyChoices = ["Word of Mouth", "Google", "Social Media", "GitHub"];

  return (
    <Modal
      open={open}
      noPadding
      hideCloseButton
      maxWidth="max-w-6xl"
      setOpen={setOpen}
      closeOnOutsideClick={false}>
      <div className="grid w-full grid-cols-2">
        <div className="col-span-1 flex flex-col gap-4 px-16 py-20">
          <h1 className="pb-8 text-6xl font-semibold text-slate-300">Let&apos;s start 💃</h1>
          <div className="pb-4">
            <label htmlFor="product" className="text-slate-700">
              What&apos;s your product called?
            </label>
            <Input id="product" type="text" placeholder="e.g. Formbricks" onChange={handleNameChange} />
          </div>
          <div className="pb-4">
            <label htmlFor="color" className="text-slate-700">
              What&apos;s your main color?
            </label>
            <Input id="color" type="text" placeholder="#334155" onChange={handleColorChange} />
          </div>
          <div className="flex gap-2">
            <Button>Next</Button>
            <Button variant="minimal">Skip</Button>
          </div>
        </div>
        <div className="relative col-span-1 flex cursor-not-allowed items-center justify-center">
          <div
            className="absolute left-0 right-0 top-0 h-full w-full opacity-10"
            style={{ backgroundColor: color }}/>
          <div className="pointer-events-auto relative w-full max-w-sm rounded-lg bg-white px-4 py-6 shadow-lg ring-1 ring-black ring-opacity-5 sm:p-6">
            <div className="absolute -top-6 right-5 flex h-5 items-center rounded-t bg-amber-500 px-6 py-3 text-sm font-semibold text-white">
              Preview
            </div>
            <Headline headline={`How did you hear about ${name ? name : "Formbricks"}?`} questionId="none" />
            <div className="mt-4">
              <fieldset>
                <legend className="sr-only">Choices</legend>
                <div className="pointer-events-none relative space-y-2 rounded-md">
                  {dummyChoices.map((choice) => (
                    <label
                      key={choice}
                      className="relative flex flex-col rounded-md border border-gray-200 p-4 hover:bg-slate-50 focus:outline-none">
                      <span className="flex items-center text-sm">
                        <input
                          type="radio"
                          className="h-4 w-4 border border-gray-300 focus:ring-0 focus:ring-offset-0"
                          style={{ borderColor: "brandColor", color: "brandColor" }}
                        />
                        <span className="ml-3 font-medium">{choice}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="mt-4 flex w-full justify-between">
              <Button className="pointer-events-none" style={{ backgroundColor: color }}>
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default OnboardingModal;
