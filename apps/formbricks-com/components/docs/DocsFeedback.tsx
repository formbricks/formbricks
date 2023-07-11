import { useState } from "react";
import { handleFeedbackSubmit, updateFeedback } from "../../lib/handleFeedbackSubmit";
import { Popover, PopoverTrigger, PopoverContent } from "@formbricks/ui";
import { Button } from "@formbricks/ui";
import { useRouter } from "next/router";

export const DocsFeedback: React.FC = () => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [sharedFeedback, setSharedFeedback] = useState(false);
  const [responseId, setResponseId] = useState(null);
  const [freeText, setFreeText] = useState("");

  if (
    !process.env.NEXT_PUBLIC_FORMBRICKS_COM_DOCS_FEEDBACK_SURVEY_ID ||
    !process.env.NEXT_PUBLIC_FORMBRICKS_COM_API_HOST ||
    !process.env.NEXT_PUBLIC_FORMBRICKS_COM_ENVIRONMENT_ID
  ) {
    return null;
  }

  return (
    <div className="mt-6 inline-flex cursor-default items-center rounded-md border border-slate-200 bg-white p-4 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {!sharedFeedback ? (
        <div className="text-center md:text-left">
          Is everything on this page clear?
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <div className="mt-2 inline-flex space-x-3 md:ml-4 md:mt-0">
              {["Yes 👍", " No 👎"].map((option) => (
                <PopoverTrigger
                  key={option}
                  className="rounded border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-slate-300"
                  onClick={async () => {
                    const id = await handleFeedbackSubmit(option, router.asPath);
                    setResponseId(id);
                  }}>
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
                  className="focus:border-brand-dark focus:ring-brand-dark mb-2 w-full rounded-md bg-white text-sm text-slate-900 dark:bg-slate-600 dark:text-slate-200 dark:placeholder:text-slate-200"
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
};

export default DocsFeedback;
