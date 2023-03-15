"use client";

import Modal from "@/components/shared/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { CursorArrowRaysIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import type { MatchType } from "./testURLmatch";
import { testURLmatch } from "./testURLmatch";
import clsx from "clsx";

interface EventDetailModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export default function AddNoCodeEventModal({ open, setOpen }: EventDetailModalProps) {
  const createEvent = () => {
    console.log("Save changes");
    setOpen(false);
  };

  const [url1, setUrl1] = useState("");
  const [url2, setUrl2] = useState("");
  const [matchType, setMatchType] = useState<MatchType>("exactMatch");
  const [isMatch, setIsMatch] = useState("");

  const handleMatchClick = () => {
    const match = testURLmatch(url1, url2, matchType);
    setIsMatch(match);
  };

  return (
    <Modal open={open} setOpen={setOpen} noPadding>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-6 w-6 text-slate-500">
                <CursorArrowRaysIcon />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">Add No-Code Event</div>
                <div className="text-sm text-slate-500">
                  Create a new no-code event to filter your user base with.
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-between rounded-lg p-6">
          <div>
            <form className="space-y-4">
              <div>
                <Label>Select By</Label>
                <RadioGroup defaultValue="page-url" className="flex">
                  <div className="flex items-center space-x-2 rounded-lg border border-slate-200 p-3">
                    <RadioGroupItem value="page-url" id="page-url" className="bg-slate-50" />
                    <Label htmlFor="page-url" className="flex cursor-pointer items-center">
                      Page URL
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-lg bg-slate-50 p-3">
                    <RadioGroupItem disabled value="inner-html" id="inner-html" className="bg-slate-50" />
                    <Label
                      htmlFor="inner-html"
                      className="flex cursor-not-allowed items-center text-slate-500">
                      Inner Text
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-lg bg-slate-50 p-3">
                    <RadioGroupItem disabled value="css-selector" id="css-selector" className="bg-slate-50" />
                    <Label
                      htmlFor="css-selector"
                      className="flex cursor-not-allowed items-center text-slate-500">
                      CSS Selector
                    </Label>
                  </div>
                </RadioGroup>
              </div>
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
                  <Select
                    onValueChange={(e) => {
                      setMatchType(e as MatchType);
                      setIsMatch("default");
                    }}>
                    <SelectTrigger className="w-[180px]">
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
                  <Input
                    type="text"
                    value={url2}
                    onChange={(e) => {
                      setUrl2(e.target.value);
                      setIsMatch("default");
                    }}
                    placeholder="e.g. https://app.formbricks.com/dashboard"
                  />
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
                      type="text"
                      value={url1}
                      onChange={(e) => {
                        setUrl1(e.target.value);
                        setIsMatch("default");
                      }}
                      className={clsx(
                        isMatch === "yes"
                          ? "border-green-500 bg-green-50"
                          : isMatch === "no"
                          ? "border-red-200 bg-red-50"
                          : isMatch === "default"
                          ? "border-slate-200 bg-white"
                          : null
                      )}
                      placeholder="Paste the URL you want the event to trigger on"
                    />
                    <Button
                      variant="secondary"
                      className="ml-2 whitespace-nowrap"
                      onClick={(e) => {
                        e.preventDefault();
                        handleMatchClick();
                      }}>
                      Test Match
                    </Button>
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
            <Button variant="primary" onClick={createEvent}>
              Add event
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
