import { TrashIcon } from "@heroicons/react/outline";
import dynamic from "next/dynamic";
import { persistNoCodeForm, useNoCodeForm } from "../../lib/noCodeForm";
import Loading from "../Loading";
let Editor = dynamic(() => import("../editorjs/Editor"), {
  ssr: false,
});

export default function Page({ formId, page, pageIdx, deletePageAction }) {
  const { noCodeForm, isLoadingNoCodeForm, mutateNoCodeForm } =
    useNoCodeForm(formId);

  const updatePage = async (blocks) => {
    const newNoCodeForm = JSON.parse(JSON.stringify(noCodeForm));
    if (pageIdx < newNoCodeForm.pagesDraft.length) {
      newNoCodeForm.pagesDraft[pageIdx].blocks = blocks;
      await persistNoCodeForm(newNoCodeForm);
      mutateNoCodeForm(newNoCodeForm);
    } else {
      throw Error(
        `updatePage error: Page at position ${pageIdx} not found in pagesDraft`
      );
    }
  };

  if (isLoadingNoCodeForm) {
    return <Loading />;
  }

  return (
    <div className="flex w-full">
      <div className="flex w-8">
        {pageIdx !== 0 && (
          <button
            className="flex items-center h-full text-gray-400"
            onClick={() => {
              if (confirm("Do you really want to delete this page?")) {
                deletePageAction(pageIdx);
              }
            }}
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        )}
      </div>
      <div className="relative w-full p-10 rounded-md bg-ui-gray-lighter">
        <div className="relative">
          {Editor && (
            <Editor
              id={`${page.id}-editor`}
              autofocus={pageIdx === 0}
              onChange={(blocks) => updatePage(blocks)}
              value={noCodeForm.pagesDraft[pageIdx]}
            />
          )}
        </div>
      </div>
    </div>
  );
}
