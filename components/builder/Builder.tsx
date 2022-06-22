import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { persistNoCodeForm, useNoCodeForm } from "../../lib/noCodeForm";
import Loading from "../Loading";
import Page from "./Page";
import ShareModal from "./ShareModal";
import UsageIntro from "./UsageIntro";

export default function Builder({ formId }) {
  const { noCodeForm, isLoadingNoCodeForm, mutateNoCodeForm } =
    useNoCodeForm(formId);
  const [isInitialized, setIsInitialized] = useState(false);
  const [openShareModal, setOpenShareModal] = useState(false);

  const addPage = useCallback(async () => {
    const newNoCodeForm = JSON.parse(JSON.stringify(noCodeForm));
    newNoCodeForm.pagesDraft.push({
      id: uuidv4(),
      blocks: [],
    });
    await persistNoCodeForm(newNoCodeForm);
    mutateNoCodeForm(newNoCodeForm);
  }, [noCodeForm, mutateNoCodeForm]);

  const deletePage = async (pageIdx) => {
    const newNoCodeForm = JSON.parse(JSON.stringify(noCodeForm));
    newNoCodeForm.pagesDraft.splice(pageIdx, 1);
    await persistNoCodeForm(newNoCodeForm);
    mutateNoCodeForm(newNoCodeForm);
  };

  const initPages = useCallback(async () => {
    if (!isLoadingNoCodeForm && !isInitialized) {
      if (noCodeForm.pagesDraft.length === 0) {
        await addPage();
      }
      setIsInitialized(true);
    }
  }, [isLoadingNoCodeForm, noCodeForm, addPage, isInitialized]);

  const publishChanges = async () => {
    const newNoCodeForm = JSON.parse(JSON.stringify(noCodeForm));
    newNoCodeForm.pages = newNoCodeForm.pagesDraft;
    await persistNoCodeForm(newNoCodeForm);
    mutateNoCodeForm(newNoCodeForm);
    setOpenShareModal(true);
  };

  useEffect(() => {
    initPages();
  }, [isLoadingNoCodeForm, initPages]);

  if (isLoadingNoCodeForm) {
    return <Loading />;
  }

  return (
    <>
      <div className="relative z-10 flex flex-shrink-0 h-16 border-b border-gray-200 shadow-inner bg-gray-50">
        <div className="flex items-center justify-center flex-1 px-4">
          <nav className="flex space-x-4" aria-label="resultModes">
            <button
              onClick={() => addPage()}
              className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-800 rounded-md hover:text-gray-600"
            >
              Add Page
            </button>
            <Link href={`/forms/${formId}/preview`}>
              <a className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-800 rounded-md hover:text-gray-600">
                Preview Form
              </a>
            </Link>
            <button
              onClick={() => publishChanges()}
              className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-800 rounded-md hover:text-gray-600"
            >
              Publish
            </button>
            <button
              onClick={() => setOpenShareModal(true)}
              className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-800 rounded-md hover:text-gray-600"
            >
              Share
            </button>
          </nav>
        </div>
      </div>

      <div className="w-full py-6 bg-gray-100">
        <div className="flex justify-center w-full mt-10">
          <div className="w-full px-4 max-w-7xl">
            <div className="grid grid-cols-1 gap-6">
              <div className="px-10">
                <UsageIntro />
              </div>
              {noCodeForm.pagesDraft.map((page, pageIdx) => (
                <Page
                  key={page.id}
                  formId={formId}
                  page={page}
                  pageIdx={pageIdx}
                  deletePageAction={deletePage}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <ShareModal
        open={openShareModal}
        setOpen={setOpenShareModal}
        formId={formId}
      />
    </>
  );
}
