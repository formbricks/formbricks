/**
 * Lexical wraps a nested list in a structural <li> that carries no text of its own. Its class and
 * the declaration that hides its marker are declared here once and consumed by
 * `suppressNestedListMarkers` (email preview) and, by reference, by the two stylesheets that style
 * the same markup: `styles-editor-frontend.css` and `packages/surveys/src/styles/global.css`.
 * `example-theme.test.ts` fails if a rename leaves one of those stylesheets behind.
 */
export const NESTED_LIST_ITEM_CLASS = "fb-editor-nested-listitem";
export const NESTED_LIST_ITEM_MARKER_STYLE = "list-style-type:none";

export const exampleTheme = {
  rtl: "fb-editor-rtl",
  ltr: "fb-editor-ltr",
  placeholder: "fb-editor-placeholder",
  paragraph: "fb-editor-paragraph",
  heading: {
    h1: "fb-editor-heading-h1",
    h2: "fb-editor-heading-h2",
  },
  list: {
    nested: {
      listitem: NESTED_LIST_ITEM_CLASS,
    },
    ol: "fb-editor-list-ol",
    ul: "fb-editor-list-ul",
    listitem: "fb-editor-listitem",
  },
  image: "fb-editor-image",
  link: "fb-editor-link",
  text: {
    bold: "fb-editor-text-bold",
    italic: "fb-editor-text-italic",
    underline: "fb-editor-text-underline",
  },
};
