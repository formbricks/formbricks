import { useState } from "react";
import { handleFeedbackSubmit, updateFeedback } from "../../lib/handleFeedbackSubmit";
import { Popover, PopoverTrigger, PopoverContent, Button } from "@formbricks/ui";
import { useRouter } from "next/router";

export default function DocsFeedback() {
  const router = useRouter();
  const [freeText, setFreeText] = useState("");
  const [responseId, setResponseId] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [sharedFeedback, setSharedFeedback] = useState(false);

  return (
    <div className="mt-6 inline-flex cursor-default items-center rounded-md border border-slate-200 bg-white p-4 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {!sharedFeedback ? (
        <div>
          Was this page helpful?
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger
              className="mx-4 border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-slate-300"
              onClick={async () => {
                const id = await handleFeedbackSubmit("Yes 👍", router.asPath);
                setResponseId(id);
              }}>
              <Button
                variant="minimal"
                className="mx-4 border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-slate-300"
                onClick={async () => {
                  const id = await handleFeedbackSubmit("Yes 👍", router.asPath);
                  setResponseId(id);
                }}>
                Yes 👍
              </Button>
              <Button
                variant="minimal"
                className="border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-slate-300"
                onClick={async () => {
                  const id = await handleFeedbackSubmit("No 👎", router.asPath);
                  setResponseId(id);
                }}>
                No 👎
              </Button>
            </PopoverTrigger>
            <PopoverContent className="border-slate-300 bg-white dark:border-slate-500 dark:bg-slate-700">
              <form>
                <textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="Please explain why..."
                  className="w-full rounded-md bg-white text-sm text-slate-900 dark:bg-slate-600 dark:text-slate-200 dark:placeholder:text-slate-200"
                />
                <div className="text-right">
                  <Button
                    type="submit"
                    variant="primary"
                    onClick={(e) => {
                      e.preventDefault();
                      updateFeedback(freeText, responseId);
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
}
