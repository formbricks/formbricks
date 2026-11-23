"use client";

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import {
  Compartment,
  EditorState,
  type Extension,
  RangeSet,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  GutterMarker,
  WidgetType,
  gutterLineClass,
  keymap,
  lineNumbers,
  placeholder as placeholderText,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";
import type { TJsonEditorVariableRequest } from "@/modules/ee/workflows/components/json-editor/json-editor";
import { findJsonVariableTokens, insertJsonVariableToken } from "@/modules/ee/workflows/lib/json-editor";
import { getVariableDisplayName } from "@/modules/ee/workflows/lib/variable-name";

interface JsonCodeMirrorProps {
  id?: string;
  value: string;
  onChange?: (value: string) => void;
  ariaLabel: string;
  ariaDescribedBy?: string;
  isInvalid: boolean;
  /** 1-based line to mark with the error band, or null. */
  errorLine: number | null;
  placeholder?: string;
  onRequestVariable?: (request: TJsonEditorVariableRequest) => void;
  minHeight: number;
}

// Kit slate palette. Every color keeps 4.5:1 on white, punctuation included.
const SLATE = { 400: "#94a3b8", 500: "#64748b", 600: "#475569", 700: "#334155", 900: "#0f172a" };

const jsonHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: SLATE[900] },
  { tag: tags.string, color: SLATE[600] },
  { tag: [tags.number, tags.bool, tags.null], color: SLATE[700], fontWeight: "600" },
  { tag: [tags.brace, tags.squareBracket, tags.separator, tags.punctuation], color: SLATE[500] },
]);

// Same bands as CssCodeField: red-50 across the line, red-100 with bold red-700 in the gutter.
const createTheme = (minHeight: number) =>
  EditorView.theme({
    "&": { fontSize: "12px", backgroundColor: "transparent", borderRadius: "6px" },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
      fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
      lineHeight: "20px",
      maxHeight: "24rem",
      overflow: "auto",
    },
    ".cm-content": { padding: "8px 0", minHeight: `${minHeight - 2}px`, caretColor: SLATE[900] },
    ".cm-line": { padding: "0 12px", color: SLATE[700] },
    ".cm-gutters": {
      backgroundColor: "#f8fafc",
      borderRight: "1px solid #e2e8f0",
      color: SLATE[400],
      borderTopLeftRadius: "6px",
      borderBottomLeftRadius: "6px",
    },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 12px" },
    ".cm-json-error-line": { backgroundColor: "#fef2f2" },
    ".cm-gutterElement.cm-json-error-gutter": {
      backgroundColor: "#fee2e2",
      color: "#b91c1c",
      fontWeight: "700",
    },
    ".cm-placeholder": { color: SLATE[400] },
  });

// --- Error line ------------------------------------------------------------------------------

const setErrorLine = StateEffect.define<number | null>();

const errorGutterMarker = new (class extends GutterMarker {
  elementClass = "cm-json-error-gutter";
})();

interface TErrorLineMarks {
  line: DecorationSet;
  gutter: RangeSet<GutterMarker>;
}

const NO_ERROR_MARKS: TErrorLineMarks = { line: Decoration.none, gutter: RangeSet.empty };

const buildErrorLineMarks = (state: EditorState, lineNumber: number | null): TErrorLineMarks => {
  if (lineNumber === null || lineNumber < 1 || lineNumber > state.doc.lines) return NO_ERROR_MARKS;
  const { from } = state.doc.line(lineNumber);
  return {
    line: Decoration.set([Decoration.line({ class: "cm-json-error-line" }).range(from)]),
    gutter: RangeSet.of([errorGutterMarker.range(from)]),
  };
};

const errorLineField = StateField.define<TErrorLineMarks>({
  create: () => NO_ERROR_MARKS,
  update: (marks, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setErrorLine)) return buildErrorLineMarks(transaction.state, effect.value);
    }
    if (!transaction.docChanged) return marks;
    return { line: marks.line.map(transaction.changes), gutter: marks.gutter.map(transaction.changes) };
  },
  provide: (field) => [
    EditorView.decorations.from(field, (marks) => marks.line),
    gutterLineClass.from(field, (marks) => marks.gutter),
  ],
});

// --- Variable chips --------------------------------------------------------------------------

class VariableChipWidget extends WidgetType {
  constructor(readonly name: string) {
    super();
  }

  eq(other: VariableChipWidget) {
    return other.name === this.name;
  }

  toDOM() {
    // Same look as the email action's recall chip.
    const chip = document.createElement("span");
    chip.className = "rounded-md bg-slate-100 px-1 text-slate-800";
    chip.textContent = `@${this.name}`;
    return chip;
  }
}

const buildVariableChips = (state: EditorState): DecorationSet => {
  const builder = new RangeSetBuilder<Decoration>();
  for (const token of findJsonVariableTokens(state.doc.toString())) {
    builder.add(
      token.from,
      token.to,
      Decoration.replace({ widget: new VariableChipWidget(getVariableDisplayName(token.path)) })
    );
  }
  return builder.finish();
};

// A chip is one unit: the caret steps over it and Backspace removes the whole token.
const variableChipField = StateField.define<DecorationSet>({
  create: buildVariableChips,
  update: (chips, transaction) => (transaction.docChanged ? buildVariableChips(transaction.state) : chips),
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});

// --- Component -------------------------------------------------------------------------------

const getAccessibilityAttributes = (
  props: Pick<JsonCodeMirrorProps, "ariaLabel" | "ariaDescribedBy" | "isInvalid" | "id">
) =>
  EditorView.contentAttributes.of({
    "aria-label": props.ariaLabel,
    "aria-invalid": String(props.isInvalid),
    ...(props.id ? { id: props.id } : {}),
    ...(props.ariaDescribedBy ? { "aria-describedby": props.ariaDescribedBy } : {}),
  });

const getEditabilityExtensions = (isEditable: boolean): Extension => [
  EditorState.readOnly.of(!isEditable),
  EditorView.editable.of(isEditable),
];

export const JsonCodeMirror = ({
  id,
  value,
  onChange,
  ariaLabel,
  ariaDescribedBy,
  isInvalid,
  errorLine,
  placeholder,
  onRequestVariable,
  minHeight,
}: Readonly<JsonCodeMirrorProps>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // The latest props, read by the long-lived editor's listeners.
  const onChangeRef = useRef(onChange);
  const onRequestVariableRef = useRef(onRequestVariable);
  const lastValueRef = useRef(value);
  const compartments = useRef({
    accessibility: new Compartment(),
    editability: new Compartment(),
    placeholder: new Compartment(),
  });
  const isEditable = onChange !== undefined;

  useEffect(() => {
    onChangeRef.current = onChange;
    onRequestVariableRef.current = onRequestVariable;
  }, [onChange, onRequestVariable]);

  // Created once; later prop changes reconfigure it below instead of rebuilding it.
  useEffect(() => {
    if (!containerRef.current) return;
    const { accessibility, editability, placeholder: placeholderCompartment } = compartments.current;

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: lastValueRef.current,
        extensions: [
          lineNumbers(),
          history(),
          // No indentWithTab: Tab keeps moving focus out of the field, as in every other input.
          keymap.of([...defaultKeymap, ...historyKeymap]),
          json(),
          syntaxHighlighting(jsonHighlightStyle),
          createTheme(minHeight),
          errorLineField,
          variableChipField,
          accessibility.of(getAccessibilityAttributes({ id, ariaLabel, ariaDescribedBy, isInvalid })),
          editability.of(getEditabilityExtensions(isEditable)),
          placeholderCompartment.of(placeholder ? placeholderText(placeholder) : []),
          EditorView.inputHandler.of((editorView, from, to, text) => {
            const requestVariable = onRequestVariableRef.current;
            if (text !== "@" || !requestVariable) return false;
            editorView.dispatch({
              changes: { from, to, insert: "@" },
              selection: { anchor: from + 1 },
              userEvent: "input.type",
            });
            const coords = editorView.coordsAtPos(from);
            requestVariable({
              anchorRect: coords ? { left: coords.left, top: coords.top, bottom: coords.bottom } : null,
              insert: (variable) => {
                // The `@` moved or went away while the picker was open: nothing to replace.
                if (editorView.state.sliceDoc(from, from + 1) !== "@") return;
                const result = insertJsonVariableToken(
                  editorView.state.doc.toString(),
                  from,
                  from + 1,
                  variable
                );
                editorView.dispatch({
                  changes: { from, to: from + 1, insert: result.text.slice(from, result.cursor) },
                  selection: { anchor: result.cursor },
                  userEvent: "input",
                });
                editorView.focus();
              },
              dismiss: () => editorView.focus(),
            });
            return true;
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            const next = update.state.doc.toString();
            if (next === lastValueRef.current) return;
            lastValueRef.current = next;
            onChangeRef.current?.(next);
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The editor is built once per mount; the effects below keep it in step with its props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A value set from outside (Reset to last received, a loaded draft) replaces the text.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || value === lastValueRef.current) return;
    lastValueRef.current = value;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setErrorLine.of(errorLine) });
  }, [errorLine, value]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.current.accessibility.reconfigure(
        getAccessibilityAttributes({ id, ariaLabel, ariaDescribedBy, isInvalid })
      ),
    });
  }, [id, ariaLabel, ariaDescribedBy, isInvalid]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.current.editability.reconfigure(getEditabilityExtensions(isEditable)),
    });
  }, [isEditable]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.current.placeholder.reconfigure(placeholder ? placeholderText(placeholder) : []),
    });
  }, [placeholder]);

  return <div ref={containerRef} />;
};
