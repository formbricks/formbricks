import { persistSubmission, useSubmissions } from "@/lib/submissions";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import { useState } from "react";
import { toast } from "react-toastify";

// add interface props for tags
interface TaggingProps {
  submission: any;
}

export default function Tagging({ submission }: TaggingProps) {
  const router = useRouter();
  const [isEditingTag, setIsEditingTag] = useState("");

  const [tagInput, setTagInput] = useState("");
  const { submissions, mutateSubmissions } = useSubmissions(
    router.query.organisationId?.toString(),
    router.query.formId?.toString()
  );

  // update submissions
  const updateSubmissionsLocally = (updatedSubmission) => {
    const updatedSubmissions = JSON.parse(JSON.stringify(submissions));
    const submissionIdx = updatedSubmissions.findIndex((s) => s.id === updatedSubmission.id);
    updatedSubmissions[submissionIdx] = updatedSubmission;
    mutateSubmissions(updatedSubmissions, false);
  };

  // add tag to submission
  const addTag = async (submission, tag) => {
    if (!tag) return;
    if (submission.tags.includes(tag)) {
      toast.error("This submission is already tagged with this tag.");
      return;
    }
    const updatedSubmission = JSON.parse(JSON.stringify(submission));
    updatedSubmission.tags = [...updatedSubmission.tags, tag];
    updateSubmissionsLocally(updatedSubmission);
    await persistSubmission(updatedSubmission, router.query.organisationId?.toString());
  };

  //remove tag from submission
  const removeTag = async (submission, tag) => {
    const updatedSubmission = JSON.parse(JSON.stringify(submission));
    updatedSubmission.tags = updatedSubmission.tags.filter((t) => t !== tag);
    updateSubmissionsLocally(updatedSubmission);
    await persistSubmission(updatedSubmission, router.query.organisationId?.toString());
  };

  return (
    <div className="border-t border-slate-100 px-6 py-4">
      <ul className="flex flex-wrap space-x-2">
        {submission.tags.map((tag: string) => (
          <li
            key={tag}
            className="my-1 inline-flex items-center rounded-full bg-slate-600 py-0.5 pl-2.5 pr-1 text-sm font-medium text-slate-100">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(submission, tag)}
              className="ml-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-500 hover:text-slate-200 focus:bg-slate-500 focus:text-white focus:outline-none">
              <span className="sr-only">Remove large option</span>
              <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
              </svg>
            </button>
          </li>
        ))}

        <li>
          {isEditingTag && submission.id === isEditingTag ? (
            <input
              autoFocus={true}
              type="text"
              className="h-8 w-32 rounded-full border border-slate-300 bg-slate-50 text-sm text-slate-400 outline-none hover:text-slate-600 focus:border-2 focus:border-slate-300"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  addTag(submission, tagInput);
                  setIsEditingTag("");
                  setTagInput("");
                }
              }}
              onBlur={() => {
                setIsEditingTag("");
              }}
            />
          ) : (
            <button
              type="button"
              className="rounded-full border border-dashed border-slate-300 py-1 px-3 text-sm text-slate-400 hover:text-slate-600"
              onClick={() => {
                setIsEditingTag(submission.id);
              }}>
              add tag <PlusIcon className="inline h-3 w-3" />
            </button>
          )}
        </li>
      </ul>
    </div>
  );
}
