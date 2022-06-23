import dynamic from "next/dynamic";
import { persistNoCodeForm, useNoCodeForm } from "../../lib/noCodeForm";
import Loading from "../Loading";
import PageToolbar from "./PageToolbar";
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

  const setPageType = async (newType) => {
    const newNoCodeForm = JSON.parse(JSON.stringify(noCodeForm));
    newNoCodeForm.pagesDraft[pageIdx].type = newType;
    await persistNoCodeForm(newNoCodeForm);
    mutateNoCodeForm(newNoCodeForm);
  };

  if (isLoadingNoCodeForm) {
    return <Loading />;
  }

  return (
    <div className="relative w-full bg-white">
      {pageIdx !== 0 && (
        <div className="z-10">
          <PageToolbar
            page={page}
            pageIdx={pageIdx}
            deletePageAction={deletePageAction}
            setPageType={setPageType}
          />
        </div>
      )}
      <div className="relative w-full p-10 ">
        <div className="relative max-w-5xl mx-auto">
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
