import { TrashIcon } from "@heroicons/react/outline";
import dynamic from "next/dynamic";
let Editor = dynamic(() => import("../editorjs/Editor"), {
  ssr: false,
});

export default function Page({
  page,
  pageIdx,
  pagesDraft,
  setPagesDraft,
  deletePageAction,
}) {
  const updatePage = (blocks) => {
    const newPagesDraft = JSON.parse(JSON.stringify(pagesDraft));
    if (pageIdx < newPagesDraft.length) {
      newPagesDraft[pageIdx].blocks = blocks;
      setPagesDraft(newPagesDraft);
    } else {
      throw Error(
        `updatePage error: Page at position ${pageIdx} not found in pagesDraft`
      );
    }
  };

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
      <div className="relative w-full p-10 bg-white rounded-lg">
        <div className="relative">
          {Editor && (
            <Editor
              id={`${page.id}-editor`}
              autofocus={pageIdx === 0}
              onChange={(blocks) => updatePage(blocks)}
              value={pagesDraft[pageIdx]}
            />
          )}
        </div>
      </div>
    </div>
  );
}
