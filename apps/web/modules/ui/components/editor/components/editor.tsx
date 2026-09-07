import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { LINK, TRANSFORMERS } from "@lexical/markdown";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { TSurvey, TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { FallbackInput } from "@/modules/survey/components/element-form-input/components/fallback-input";
import "@/modules/ui/components/editor/styles-editor-frontend.css";
import "@/modules/ui/components/editor/styles-editor.css";
import { exampleTheme } from "../lib/example-theme";
import "../styles-editor-frontend.css";
import "../styles-editor.css";
import { PlaygroundAutoLinkPlugin as AutoLinkPlugin } from "./auto-link-plugin";
import { EditorContentChecker } from "./editor-content-checker";
import { LinkEditor } from "./link-editor";
import { ListTabIndentationPlugin } from "./list-tab-indentation-plugin";
import { RecallNode } from "./recall-node";
import { RecallPlugin } from "./recall-plugin";
import { ToolbarPlugin } from "./toolbar-plugin";

/*
 Detault toolbar items:
  - blockType
  - bold
  - italic
  - link
  - underline
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
  /**
   * Id of the element describing an invalid state (an inline error message). Forwarded to the
   * contenteditable alongside `aria-invalid`, so the editor announces its error like a native input
   * does — `isInvalid` alone only paints the border red.
   */
  ariaDescribedBy?: string;
  localSurvey?: TSurvey;
  elementId?: string;
  selectedLanguageCode?: string;
  fallbacks?: { [id: string]: string };
  addFallback?: () => void;
  autoFocus?: boolean;
  id?: string;
  isExternalUrlsAllowed?: boolean;
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
    RecallNode,
  ],
};

// LexicalComposer only reads `initialConfig.editable` at mount; without this sync a mounted
// editor keeps its initial mode when the `editable` prop flips (e.g. a workflow being enabled
// while its email body is open in the inspector).
const SyncEditablePlugin = ({ editable }: Readonly<{ editable: boolean }>) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (editor.isEditable() !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  return null;
};

export const Editor = (props: TextEditorProps) => {
  const editable = props.editable ?? true;
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [showFallbackInput, setShowFallbackInput] = useState(false);
  const [recallItems, setRecallItems] = useState<TSurveyRecallItem[]>([]);
  const [fallbacks, setFallbacks] = useState<{ [id: string]: string }>(props.fallbacks || {});
  const [addFallbackFunction, setAddFallbackFunction] = useState<(() => void) | null>(null);
  const [showRecallItemSelect, setShowRecallItemSelect] = useState(false);
  const [showLinkEditor, setShowLinkEditor] = useState(false);

  return (
    <>
      <div className={cn("editor rounded-md", editable ? "cursor-text" : "cursor-not-allowed")}>
        <LexicalComposer initialConfig={{ ...editorConfig, editable }}>
          <SyncEditablePlugin editable={editable} />
          <div
            ref={editorContainerRef}
            className={cn(
              "editor-container rounded-md p-0",
              // Defined in styles-editor.css — see the comment there for why this state can't be
              // expressed as Tailwind utilities.
              !editable && "editor-container-disabled",
              props.isInvalid && "border! border-red-500!"
            )}>
            <ToolbarPlugin
              getText={props.getText}
              setText={props.setText}
              editable={editable}
              excludedToolbarItems={props.excludedToolbarItems}
              variables={props.variables}
              updateTemplate={props.updateTemplate}
              firstRender={props.firstRender}
              setFirstRender={props.setFirstRender}
              localSurvey={props.localSurvey}
              elementId={props.elementId}
              selectedLanguageCode={props.selectedLanguageCode}
              setShowRecallItemSelect={setShowRecallItemSelect}
              recallItemsCount={recallItems.length}
              setShowFallbackInput={setShowFallbackInput}
              setShowLinkEditor={setShowLinkEditor}
              isExternalUrlsAllowed={props.isExternalUrlsAllowed}
            />
            {props.onEmptyChange ? <EditorContentChecker onEmptyChange={props.onEmptyChange} /> : null}
            <div className="editor-inner scroll-bar" style={{ height: props.height }}>
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    style={{ height: props.height }}
                    className="editor-input"
                    aria-labelledby={props.id}
                    aria-invalid={props.isInvalid ? true : undefined}
                    aria-describedby={props.ariaDescribedBy}
                    dir="auto"
                  />
                }
                placeholder={
                  // Overlay the (empty-state-only) placeholder on the contentEditable instead of
                  // flowing after it — a static sibling would render below the input, which shows
                  // once the input's min-height exceeds one line. pointer-events-none keeps clicks
                  // on the placeholder text focusing the editor. Padding/leading mirror .editor-input.
                  <div
                    className="pointer-events-none absolute top-0 left-0 px-2.5 pt-[5px] text-sm leading-6 text-slate-400"
                    dir="auto">
                    {props.placeholder ?? ""}
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <ListPlugin />
              <ListTabIndentationPlugin />
              {props.isExternalUrlsAllowed && <LinkPlugin />}
              {props.isExternalUrlsAllowed && <AutoLinkPlugin />}
              {props.autoFocus && <AutoFocusPlugin />}
              {props.localSurvey && props.elementId && props.selectedLanguageCode && (
                <RecallPlugin
                  localSurvey={props.localSurvey}
                  elementId={props.elementId}
                  selectedLanguageCode={props.selectedLanguageCode}
                  recallItems={recallItems}
                  setRecallItems={setRecallItems}
                  fallbacks={fallbacks}
                  setFallbacks={setFallbacks}
                  onShowFallbackInput={() => setShowFallbackInput(true)}
                  setAddFallbackFunction={setAddFallbackFunction}
                  setShowRecallItemSelect={setShowRecallItemSelect}
                  showRecallItemSelect={showRecallItemSelect}
                />
              )}
              <LinkEditor open={showLinkEditor} setOpen={setShowLinkEditor} />
              <MarkdownShortcutPlugin
                transformers={
                  props.disableLists
                    ? TRANSFORMERS.filter((value, index) => {
                        if (index !== 3 && index !== 4) return value;
                      }).filter((t) => (props.isExternalUrlsAllowed ? true : t !== LINK))
                    : TRANSFORMERS.filter((t) => (props.isExternalUrlsAllowed ? true : t !== LINK))
                }
              />
            </div>
          </div>
        </LexicalComposer>
      </div>
      {recallItems.length > 0 && (
        <FallbackInput
          filteredRecallItems={recallItems}
          fallbacks={fallbacks}
          setFallbacks={setFallbacks}
          addFallback={addFallbackFunction || props.addFallback || (() => {})}
          open={showFallbackInput}
          setOpen={setShowFallbackInput}
        />
      )}
    </>
  );
};
