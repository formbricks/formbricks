import { NoCodeForm } from "@prisma/client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import { useForm } from "../../lib/forms";
import { persistNoCodeForm, useNoCodeForm } from "../../lib/noCodeForm";
import Loading from "../Loading";
import Page from "./Page";
import ShareModal from "./ShareModal";

export default function Builder({ formId }) {
  const { form, isLoadingForm } = useForm(formId);
  const { noCodeForm, isLoadingNoCodeForm, mutateNoCodeForm } =
    useNoCodeForm(formId);
  const [isInitialized, setIsInitialized] = useState(false);
  const [openShareModal, setOpenShareModal] = useState(false);

  const addPage = useCallback(
    async (page = undefined) => {
      const newNoCodeForm = JSON.parse(JSON.stringify(noCodeForm));
      newNoCodeForm.pagesDraft.push(
        page || { id: uuidv4(), type: "form", blocks: [] }
      );
      await persistNoCodeForm(newNoCodeForm);
      mutateNoCodeForm(newNoCodeForm);
    },
    [noCodeForm, mutateNoCodeForm]
  );

  const deletePage = async (pageIdx) => {
    const newNoCodeForm = JSON.parse(JSON.stringify(noCodeForm));
    newNoCodeForm.pagesDraft.splice(pageIdx, 1);
    await persistNoCodeForm(newNoCodeForm);
    mutateNoCodeForm(newNoCodeForm);
  };

  const initPages = useCallback(async () => {
    if (!isLoadingNoCodeForm && !isLoadingForm && !isInitialized) {
      if (noCodeForm.pagesDraft.length === 0) {
        const newNoCodeForm: NoCodeForm = JSON.parse(
          JSON.stringify(noCodeForm)
        );
        newNoCodeForm.pagesDraft = [
          {
            id: uuidv4(),
            type: "form",
            blocks: [
              {
                id: "FrEb9paDoV",
                data: {
                  text: form.name,
                  level: 1,
                },
                type: "header",
              },
              {
                id: "qtvg94SRMB",
                data: {
                  placeholder: "",
                },
                type: "textQuestion",
              },
              {
                id: "e_N-JpRIfL",
                data: {
                  label: "Submit",
                },
                type: "submitButton",
              },
            ],
          },
          {
            id: uuidv4(),
            type: "thankyou",
            blocks: [
              {
                id: "pIcLJUy0SY",
                data: {
                  text: "Thank you for taking the time to fill out this form 🙏",
                },
                type: "paragraph",
              },
            ],
          },
        ];
        await persistNoCodeForm(newNoCodeForm);
        mutateNoCodeForm(newNoCodeForm);
      }
      setIsInitialized(true);
    }
  }, [
    isLoadingNoCodeForm,
    noCodeForm,
    isInitialized,
    isLoadingForm,
    form,
    mutateNoCodeForm,
  ]);

  const publishChanges = async () => {
    const newNoCodeForm = JSON.parse(JSON.stringify(noCodeForm));
    newNoCodeForm.pages = newNoCodeForm.pagesDraft;
    await persistNoCodeForm(newNoCodeForm);
    mutateNoCodeForm(newNoCodeForm);
    setOpenShareModal(true);
    toast("Your changes are now live 🎉");
  };

  useEffect(() => {
    initPages();
  }, [isLoadingNoCodeForm, initPages]);

  if (isLoadingNoCodeForm) {
    return <Loading />;
  }

  return (
    <>
      <div className="relative z-10 flex flex-shrink-0 h-16 shadow-inner bg-ui-gray-lighter">
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

      <div className="w-full bg-ui-gray-lighter">
        <div className="flex justify-center w-full">
          <div className="grid w-full grid-cols-1">
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
      <ShareModal
        open={openShareModal}
        setOpen={setOpenShareModal}
        formId={formId}
      />
    </>
  );
}
