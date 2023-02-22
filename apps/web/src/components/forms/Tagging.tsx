import { persistSubmission, useSubmissions } from "@/lib/submissions";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

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
    const updatedSubmission = JSON.parse(JSON.stringify(submission));
    updatedSubmission.tags = [...updatedSubmission.tags, tag];
    updateSubmissionsLocally(updatedSubmission);
    await persistSubmission(updatedSubmission, router.query.organisationId?.toString());
    console.log(updatedSubmission);
  };

  //remove tag from submission
  const removeTag = async (submission, tag) => {
    const updatedSubmission = JSON.parse(JSON.stringify(submission));
    updatedSubmission.tags = updatedSubmission.tags.filter((t) => t !== tag);
    updateSubmissionsLocally(updatedSubmission);
    await persistSubmission(updatedSubmission, router.query.organisationId?.toString());
    console.log(updatedSubmission);
  };

  return (
    <ul>
      {submission.tags.map((tag: string) => (
        <li
          key={tag}
          className="inline-flex items-center rounded-full bg-indigo-100 py-0.5 pl-2.5 pr-1 text-sm font-medium text-indigo-700">
          {tag}
          <button
            type="button"
            onClick={() => removeTag(submission, tag)}
            className="ml-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-indigo-400 hover:bg-indigo-200 hover:text-indigo-500 focus:bg-indigo-500 focus:text-white focus:outline-none">
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
            className="rounded border border-slate-300 bg-slate-50 p-2 text-sm text-slate-400 outline-none hover:text-slate-600"
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
          />
        ) : (
          <button
            type="button"
            className="rounded border border-dashed border-slate-300 py-1.5 px-3 text-sm text-slate-400 hover:text-slate-600"
            onClick={() => {
              setIsEditingTag(submission.id);
            }}>
            add tag <PlusIcon className="inline h-3 w-3" />
          </button>
        )}
      </li>
    </ul>
  );
}
