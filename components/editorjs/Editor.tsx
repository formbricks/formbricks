/* eslint-disable react-hooks/exhaustive-deps */
import EditorJS from "@editorjs/editorjs";
import Header from "@editorjs/header";
import Paragraph from "@editorjs/paragraph";
import DragDrop from "editorjs-drag-drop";
import Undo from "editorjs-undo";
import { Fragment, useEffect } from "react";
import { persistNoCodeForm, useNoCodeForm } from "../../lib/noCodeForm";
import Loading from "../Loading";
import PageTransition from "./tools/PageTransition";
import TextQuestion from "./tools/TextQuestion";

interface EditorProps {
  id: string;
  autofocus: boolean;
  editorRef: { current: EditorJS | null };
  formId: string;
  initAction: (editor: EditorJS) => void;
}

const Editor = ({
  id,
  autofocus = false,
  editorRef,
  formId,
  initAction,
}: EditorProps) => {
  const { noCodeForm, isLoadingNoCodeForm, mutateNoCodeForm } =
    useNoCodeForm(formId);

  // This will run only once
  useEffect(() => {
    if (!isLoadingNoCodeForm) {
      if (!editorRef.current) {
        initEditor();
      }
    }
    return () => {
      destroyEditor();
    };
    async function destroyEditor() {
      await editorRef.current.isReady;
      editorRef.current.destroy();
      editorRef.current = null;
    }
  }, [isLoadingNoCodeForm]);

  const initEditor = () => {
    const editor = new EditorJS({
      minHeight: 0,
      holder: id,
      data: { blocks: noCodeForm.blocksDraft },
      onReady: () => {
        editorRef.current = editor;
        new DragDrop(editor);
        new Undo({ editor });
        if (editor.blocks.getBlocksCount() === 1) {
          initAction(editor);
        }
      },
      onChange: async () => {
        let content = await editor.saver.save();
        const newNoCodeForm = JSON.parse(JSON.stringify(noCodeForm));
        newNoCodeForm.blocksDraft = content.blocks;
        await persistNoCodeForm(newNoCodeForm);
        mutateNoCodeForm(newNoCodeForm);
      },
      autofocus: autofocus,
      defaultBlock: "paragraph",
      tools: {
        textQuestion: TextQuestion,
        pageTransition: PageTransition,
        paragraph: {
          class: Paragraph,
          inlineToolbar: true,
          config: {
            placeholder:
              "Start with your content or hit tab-key to insert block",
          },
        },
        header: {
          class: Header,
          config: {
            placeholder: "Enter a header",
            levels: [1, 2, 3],
            defaultLevel: 1,
          },
        },
      },
    });
  };

  if (isLoadingNoCodeForm) {
    return <Loading />;
  }

  return (
    <Fragment>
      <div id={id} />
    </Fragment>
  );
};

export default Editor;
