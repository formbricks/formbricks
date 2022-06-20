import { useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { persistNoCodeForm, useNoCodeForm } from "../../lib/noCodeForm";
import Loading from "../Loading";
import Page from "./Page";
import UsageIntro from "./UsageIntro";
import LoadingModal from "../LoadingModal";

export default function Builder({ formId }) {
  const { noCodeForm, isLoadingNoCodeForm, mutateNoCodeForm } =
    useNoCodeForm(formId);
  const [pagesDraft, setPagesDraft] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const save = async () => {
    setIsLoading(true);
    const newNoCodeForm = JSON.parse(JSON.stringify(noCodeForm));
    newNoCodeForm.pagesDraft = pagesDraft;
    await persistNoCodeForm(newNoCodeForm);
    mutateNoCodeForm(newNoCodeForm);
    setIsLoading(false);
  };

  const addPage = useCallback(() => {
    const newPagesDraft = JSON.parse(JSON.stringify(pagesDraft));
    newPagesDraft.push({
      id: uuidv4(),
      blocks: [],
    });
    setPagesDraft(newPagesDraft);
  }, [pagesDraft, setPagesDraft]);

  const deletePage = (pageIdx) => {
    const newPagesDraft = JSON.parse(JSON.stringify(pagesDraft));
    newPagesDraft.splice(pageIdx, 1);
    setPagesDraft(newPagesDraft);
  };

  const initPages = useCallback(() => {
    if (!isLoadingNoCodeForm && !isInitialized) {
      if (noCodeForm.pagesDraft.length === 0) {
        addPage();
      } else {
        setPagesDraft(noCodeForm.pagesDraft);
      }
      setIsInitialized(true);
    }
  }, [isLoadingNoCodeForm, noCodeForm, addPage, isInitialized]);

  useEffect(() => {
    initPages();
  }, [isLoadingNoCodeForm, initPages]);

  if (isLoadingNoCodeForm) {
    <Loading />;
  }

  return (
    <>
      <div className="relative z-10 flex flex-shrink-0 h-16 border-b border-gray-200 shadow-inner bg-gray-50">
        <div className="flex items-center justify-center flex-1 px-4">
          <nav className="flex space-x-4" aria-label="resultModes">
            <button
              onClick={() => save()}
              className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-800 rounded-md hover:text-gray-600"
            >
              Save
            </button>
            <button
              onClick={() => addPage()}
              className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-800 rounded-md hover:text-gray-600"
            >
              Add Page
            </button>
          </nav>
        </div>
      </div>

      <div className="w-full bg-gray-100">
        <div className="flex justify-center w-full mt-10">
          <div className="w-full px-4 max-w-7xl">
            <div className="grid grid-cols-1 gap-6">
              <div className="px-10">
                <UsageIntro />
              </div>
              {pagesDraft.map((page, pageIdx) => (
                <Page
                  key={page.id}
                  page={page}
                  pageIdx={pageIdx}
                  pagesDraft={pagesDraft}
                  setPagesDraft={setPagesDraft}
                  deletePageAction={deletePage}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <LoadingModal isLoading={isLoading} />
    </>
  );
}
