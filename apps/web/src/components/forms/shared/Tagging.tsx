import { persistSubmission, useSubmissions } from "@/lib/submissions";
import { onlyUnique } from "@/lib/utils";
import { Combobox } from "@headlessui/react";
import { PlusIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";

// add interface props for tags
interface TaggingProps {
  submission: any;
}

export default function Tagging({ submission }: TaggingProps) {
  const router = useRouter();
  const [isEditingTag, setIsEditingTag] = useState("");
  const [currentTag, setCurrentTag] = useState("");

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
      setIsEditingTag("");
      setCurrentTag("");
      return;
    }
    const updatedSubmission = JSON.parse(JSON.stringify(submission));
    updatedSubmission.tags = [...updatedSubmission.tags, tag];
    updateSubmissionsLocally(updatedSubmission);
    await persistSubmission(updatedSubmission, router.query.organisationId?.toString());
    setIsEditingTag("");
    setCurrentTag("");
  };

  //remove tag from submission
  const removeTag = async (submission, tag) => {
    const updatedSubmission = JSON.parse(JSON.stringify(submission));
    updatedSubmission.tags = updatedSubmission.tags.filter((t) => t !== tag);
    updateSubmissionsLocally(updatedSubmission);
    await persistSubmission(updatedSubmission, router.query.organisationId?.toString());
  };

  // get all the tags from the submissions
  const existingTags = useMemo(() => {
    const tags = [];
    for (const submission of submissions) {
      for (const tag of submission.tags) {
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      }
    }
    return tags;
  }, [submissions]);

  const notYetAssignedTags = useMemo(
    () => existingTags.filter((tag) => !submission.tags.includes(tag)),
    [existingTags, submission.tags]
  );

  const filteredTags = useMemo(
    () =>
      currentTag === ""
        ? notYetAssignedTags
        : notYetAssignedTags.filter((notYetAssignedTag) => {
            return notYetAssignedTag.toLowerCase().includes(currentTag.toLowerCase());
          }),
    [currentTag, notYetAssignedTags]
  );

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
            <Combobox
              as="div"
              value={filteredTags.length > 0 && currentTag ? filteredTags[0] : currentTag}
              onChange={(value) => {
                addTag(submission, value);
              }}>
              <div className="relative">
                <div className="relative">
                  <Combobox.Input
                    className="h-8 w-40 rounded-full border border-slate-300 bg-slate-50 text-sm text-slate-400 outline-none hover:text-slate-600 focus:border-2 focus:border-slate-300 focus:text-slate-600"
                    autoFocus={true}
                    value={currentTag}
                    onChange={(event) => {
                      setCurrentTag(event.target.value);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingTag("");
                      setCurrentTag("");
                    }}
                    className="absolute top-1/2 right-1.5 inline-flex h-4 w-4 -translate-y-1/2 items-center  justify-center rounded-full text-slate-400 hover:bg-slate-200  focus:bg-slate-500 focus:text-white focus:outline-none">
                    <span className="sr-only">Remove large option</span>
                    <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                      <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                    </svg>
                  </button>
                </div>

                <Combobox.Options className="absolute z-10 mt-1 max-h-28 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                  {[...filteredTags, currentTag].filter(onlyUnique).map((tag) => (
                    <Combobox.Option
                      key={tag}
                      value={tag}
                      className={({ active }) =>
                        clsx(
                          "relative cursor-default select-none py-2 pl-3 pr-9",
                          active ? "bg-slate-500 text-white" : "text-gray-900"
                        )
                      }>
                      {({ selected }) => (
                        <span className={clsx("block truncate", selected && "font-semibold")}>{tag}</span>
                      )}
                    </Combobox.Option>
                  ))}
                </Combobox.Options>
              </div>
            </Combobox>
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
