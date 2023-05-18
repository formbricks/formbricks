import EditorJS from "@editorjs/editorjs";
import {
  CogIcon,
  DocumentPlusIcon,
  // EyeIcon,
  PaperAirplaneIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import dynamic from "next/dynamic";
// import { useRouter } from "next/router";
import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { useForm } from "../../lib/forms";
import { persistNoCodeForm, useNoCodeForm } from "../../lib/noCodeForm";
import LimitedWidth from "../layout/LimitedWidth";
import SecondNavBar from "../layout/SecondNavBar";
import Loading from "../Loading";
import LoadingModal from "../LoadingModal";
import ShareModal from "./ShareModal";
import SettingsModal from "./SettingsModal";
let Editor = dynamic(() => import("../editorjs/Editor"), {
  ssr: false,
});

export default function Builder({ formId }) {
  // const router = useRouter();
  const editorRef = useRef<EditorJS | null>();
  const { isLoadingForm } = useForm(formId);
  const { noCodeForm, isLoadingNoCodeForm, mutateNoCodeForm } =
    useNoCodeForm(formId); //useNoCodeFormPublic(formId)
  const [openShareModal, setOpenShareModal] = useState(false);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
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

  const publishChanges = async () => {
    setLoading(true);
    setTimeout(async () => {
      const newNoCodeForm = JSON.parse(JSON.stringify(noCodeForm));
      const firstPublish = newNoCodeForm.published ? false : true;
      newNoCodeForm.blocks = newNoCodeForm.blocksDraft;
      newNoCodeForm.published = true;
      await persistNoCodeForm(newNoCodeForm);
      mutateNoCodeForm(newNoCodeForm);
      setLoading(false);
      toast.success(
        firstPublish
          ? "Votre formulaire est maintenant publié 🎉"
          : "Vos modifications sont maintenant publiées 🎉"
      );
    }, 500);
  };

  const noCodeSecondNavigation = [
    {
      id: "addPage",
      onClick: () => addPage(),
      Icon: DocumentPlusIcon,
      //Icon: PlusIcon
      label: "Page",
    },
    // {
    //   id: "preview",
    //   onClick: () => {
    //     router.push(`/forms/${formId}/preview`);
    //   },
    //   Icon: EyeIcon,
    //   label: "Preview",
    // },
    {
      id: "publish",
      onClick: () => publishChanges(),
      Icon: PaperAirplaneIcon,
      label: "Publier",
    },
    {
      id: "share",
      onClick: () => setOpenShareModal(true),
      Icon: ShareIcon,
      label: "Partager",
    },
    {
      id: "settings",
      onClick: () => setOpenSettingsModal(true),
      Icon: CogIcon,
      label: "Paramètres",
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
      <SettingsModal
        open={openSettingsModal}
        setOpen={setOpenSettingsModal}
        formId={formId}
      />
      <LoadingModal isLoading={loading} />
    </>
  );
}
