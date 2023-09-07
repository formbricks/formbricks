"use client";

import { Button, Popover, PopoverContent, PopoverTrigger } from "@formbricks/ui";
import { useState } from "react";

export const DocsFeedback: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [sharedFeedback, setSharedFeedback] = useState(false);
  const [freeText, setFreeText] = useState("");

  return (
    <div className="mt-6 inline-flex cursor-default items-center rounded-md border border-slate-200 bg-white p-4 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {!sharedFeedback ? (
        <div className="text-center md:text-left">
          Is everything on this page clear?
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <div className="mt-2 inline-flex space-x-3 md:ml-4 md:mt-0">
              {["Yes 👍", "No 👎"].map((option) => (
                <PopoverTrigger
                  key={option}
                  className="rounded border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-slate-300">
                  {option}
                </PopoverTrigger>
              ))}
            </div>
            <PopoverContent className="border-slate-300 bg-white dark:border-slate-500 dark:bg-slate-700">
              <form>
                <textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="Please explain why..."
                  className="focus:border-brand-dark focus:ring-brand-dark mb-2 w-full rounded-md bg-white p-2 text-sm text-slate-900 dark:bg-slate-600 dark:text-slate-200 dark:placeholder:text-slate-200"
                />
                <div className="text-right">
                  <Button
                    type="submit"
                    variant="primary"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsOpen(false);
                      setFreeText("");
                      setSharedFeedback(true);
                    }}>
                    Send
                  </Button>
                </div>
              </form>
            </PopoverContent>
          </Popover>
        </div>
      ) : (
        <div>Thanks a lot, boss! 🤝</div>
      )}
    </div>
  );
};

export default DocsFeedback;
