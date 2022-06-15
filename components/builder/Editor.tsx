import { useCallback, useRef } from "react";
import { createReactEditorJS } from "react-editor-js";

const ReactEditorJS = createReactEditorJS();

const Editor = ({}) => {
  const editorCore = useRef(null);

  const handleInitialize = useCallback((instance) => {
    editorCore.current = instance;
  }, []);

  /* const handleSave = useCallback(async () => {
    const savedData = await editorCore.current.save();
    console.log(savedData);
  }, []);

  setTimeout(() => {
    // save every ten seconds
    handleSave();
  }, 10000); */

  const EDITOR_JS_TOOLS = {};

  // Editor.js This will show block editor in component
  // pass EDITOR_JS_TOOLS in tools props to configure tools with editor.js
  return (
    <ReactEditorJS
      onInitialize={handleInitialize}
      tools={EDITOR_JS_TOOLS}
      minHeight={0}
    />
  );
};

// Return the CustomEditor to use by other components.

export default Editor;
