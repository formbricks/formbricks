import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { TRANSFORMERS } from "@lexical/markdown";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { type Dispatch, type SetStateAction } from "react";
import { cn } from "@formbricks/lib/cn";
import { exampleTheme } from "../lib/ExampleTheme";
import "../stylesEditor.css";
import "../stylesEditorFrontend.css";
import { PlaygroundAutoLinkPlugin as AutoLinkPlugin } from "./AutoLinkPlugin";
import { EditorContentChecker } from "./EditorContentChecker";
import { ToolbarPlugin } from "./ToolbarPlugin";

/*
 Detault toolbar items:
  - blockType
  - bold
  - italic
  - link
*/
export type TextEditorProps = {
  getText: () => string;
  setText: (text: string) => void;
  excludedToolbarItems?: string[];
  variables?: string[];
  height?: string;
  placeholder?: string;
  disableLists?: boolean;
  updateTemplate?: boolean;
  firstRender?: boolean;
  setFirstRender?: Dispatch<SetStateAction<boolean>>;
  editable?: boolean;
  onEmptyChange?: (isEmpty: boolean) => void;
  isInvalid?: boolean;
};

const editorConfig = {
  theme: exampleTheme,
  onError(error: any) {
    throw error;
  },
  namespace: "",
  nodes: [
    HeadingNode,
    ListNode,
    ListItemNode,
    QuoteNode,
    CodeNode,
    CodeHighlightNode,
    TableNode,
    TableCellNode,
    TableRowNode,
    AutoLinkNode,
    LinkNode,
  ],
};

export const Editor = (props: TextEditorProps) => {
  const editable = props.editable ?? true;

  return (
    <div className="editor cursor-text rounded-md">
      <LexicalComposer initialConfig={{ ...editorConfig, editable }}>
        <div className={cn("editor-container rounded-md p-0", props.isInvalid && "!border !border-red-500")}>
          <ToolbarPlugin
            getText={props.getText}
            setText={props.setText}
            editable={editable}
            excludedToolbarItems={props.excludedToolbarItems}
            variables={props.variables}
            updateTemplate={props.updateTemplate}
            firstRender={props.firstRender}
            setFirstRender={props.setFirstRender}
          />
          {props.onEmptyChange ? <EditorContentChecker onEmptyChange={props.onEmptyChange} /> : null}
          <div
            className={cn("editor-inner scroll-bar", !editable && "bg-muted")}
            style={{ height: props.height }}>
            <RichTextPlugin
              contentEditable={<ContentEditable style={{ height: props.height }} className="editor-input" />}
              placeholder={
                <div className="-mt-11 cursor-text p-3 text-sm text-slate-400">{props.placeholder || ""}</div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <ListPlugin />
            <LinkPlugin />
            <AutoLinkPlugin />
            <MarkdownShortcutPlugin
              transformers={
                props.disableLists
                  ? TRANSFORMERS.filter((value, index) => {
                      if (index !== 3 && index !== 4) return value;
                    })
                  : TRANSFORMERS
              }
            />
          </div>
        </div>
      </LexicalComposer>
    </div>
  );
};
