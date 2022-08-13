import EditorJS from "@editorjs/editorjs";
import {
  BanIcon,
  DocumentAddIcon,
  EyeIcon,
  PaperAirplaneIcon, SaveIcon,
  ShareIcon,
} from "@heroicons/react/outline";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { useForm } from "../../lib/forms";
import { persistNoCodeForm, useNoCodeForm } from "../../lib/noCodeForm";
import LimitedWidth from "../layout/LimitedWidth";
import SecondNavBar from "../layout/SecondNavBar";
import Loading from "../Loading";
import LoadingModal from "../LoadingModal";
import ShareModal from "./ShareModal";
let Editor = dynamic(() => import("../editorjs/Editor"), {
  ssr: false,
});

export default function Builder({ formId }) {
  const router = useRouter();
  const editorRef = useRef<EditorJS | null>();
  const { isLoadingForm } = useForm(formId);
  const { noCodeForm, isLoadingNoCodeForm, mutateNoCodeForm } =
    useNoCodeForm(formId);
  const [openShareModal, setOpenShareModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const addPage = () => {
    editorRef.current.blocks.insert("pageTransition", {
      submitLabel: "Submit",
    });
    const block = editorRef.current.blocks.insert("paragraph");
    editorRef.current.caret.setToBlock(
      editorRef.current.blocks.getBlockIndex(block.id)
    );
  };

  const initAction = async (editor: EditorJS) => {
    editor.blocks.insert("header", {
      text: noCodeForm.form.name,
    });
    const focusBlock = editor.blocks.insert("textQuestion");
    editor.blocks.insert("pageTransition", {
      submitLabel: "Submit",
    });
    editor.blocks.insert("header", {
      text: "Thank you",
    });
    editor.blocks.insert("paragraph", {
      text: "Thanks a lot for your time and insights 🙏",
    });
    editor.blocks.delete(0); // remove defaultBlock
    editor.caret.setToBlock(
      editorRef.current.blocks.getBlockIndex(focusBlock.id)
    );
  };

  const publishOrUnpublish = async () => {
    setLoading(true);
    setTimeout(async () => {
      const newNoCodeForm = JSON.parse(JSON.stringify(noCodeForm));
      newNoCodeForm.published = !noCodeForm.published;
      await persistNoCodeForm(newNoCodeForm);
      mutateNoCodeForm(newNoCodeForm);
      setLoading(false);
      toast(newNoCodeForm.published ? "Your form is now published 🎉" : "Your form is now unpublished 😶‍🌫️");
    }, 500);
  };

  const saveChanges = async () => {
    setLoading(true);
    setTimeout(async () => {
      const newNoCodeForm = JSON.parse(JSON.stringify(noCodeForm));
      newNoCodeForm.blocks = newNoCodeForm.blocksDraft;
      await persistNoCodeForm(newNoCodeForm);
      mutateNoCodeForm(newNoCodeForm);
      setLoading(false);
      toast("Your changes have been saved 🎉");
    }, 500);
  };

  const noCodeSecondNavigation = [
    {
      id: "addPage",
      onClick: () => addPage(),
      Icon: DocumentAddIcon,
      //Icon: PlusIcon
      label: "Page",
    },
    {
      id: "preview",
      onClick: () => {
        router.push(`/forms/${formId}/preview`);
      },
      Icon: EyeIcon,
      label: "Preview",
    },
    {
      id: "save",
      onClick: () => saveChanges(),
      Icon: SaveIcon,
      label: 'Save Changes',
    },
    {
      id: "publish",
      onClick: () => publishOrUnpublish(),
      Icon: noCodeForm?.published ? BanIcon : PaperAirplaneIcon,
      label: noCodeForm?.published ? 'Unpublish' : 'Publish',
    },
    {
      id: "share",
      onClick: () => setOpenShareModal(true),
      Icon: ShareIcon,
      label: "Share",
    },
  ];

  if (isLoadingNoCodeForm || isLoadingForm) {
    return <Loading />;
  }

  return (
    <>
      <SecondNavBar navItems={noCodeSecondNavigation} />
      <div className="w-full h-full mb-20 overflow-auto bg-white">
        <div className="flex justify-center w-full pt-10 pb-56">
          <LimitedWidth>
            {Editor && (
              <Editor
                id="editor"
                formId={formId}
                editorRef={editorRef}
                autofocus={true}
                initAction={initAction}
              />
            )}
          </LimitedWidth>
        </div>
      </div>
      <ShareModal
        open={openShareModal}
        setOpen={setOpenShareModal}
        formId={formId}
      />
      <LoadingModal isLoading={loading} />
    </>
  );
}
