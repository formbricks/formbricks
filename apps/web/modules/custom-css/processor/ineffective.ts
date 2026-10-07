import { type CssNode, type DeclarationNode, generate, lexer, parse, walk } from "css-tree";
import { UNSAFE_FUNCTIONS, UNSAFE_PROPERTIES } from "./constants";
import { type TIssueLocation, fromOneBasedLocation } from "./issues";

export interface TIneffectiveDeclaration {
  code: "unknown_property" | "invalid_value";
  reason: string;
  location: TIssueLocation;
}

// Values that only resolve in the browser, or that the declaration policy already removes: neither can
// be judged against the property grammar here.
const UNCHECKABLE_FUNCTIONS = ["var", "env", "url", "src", "image", "image-set", "-webkit-image-set", "cross-fade"];
const UNCHECKABLE_VALUE = new RegExp(
  String.raw`(?:^|[^\w-])(?:${[...UNCHECKABLE_FUNCTIONS, ...Object.keys(UNSAFE_FUNCTIONS)].join("|")})\(`,
  "i"
);
// Properties the declaration policy checks itself, and escaped names (decoded only by lightningcss): the
// policy's own warning covers them.
const POLICY_PROPERTIES = new Set(["position", "all", ...Object.keys(UNSAFE_PROPERTIES)]);

/**
 * Declarations that stay in the CSS but do nothing (M2.11 notes): a property no browser knows, such as a
 * typo like `colr`, or a value that does not match the property's grammar, such as `color: notacolor`.
 * Browsers drop these silently, so they are reported instead of removed. Checked against the MDN property
 * grammar (css-tree) on the customer's own source, which also gives each note its exact line and column.
 * Custom and vendor-prefixed properties are left alone.
 */
export const findIneffectiveDeclarations = (source: string): TIneffectiveDeclaration[] => {
  let ast: CssNode;
  try {
    // Syntax errors are lightningcss's to report; this pass only reads what parses.
    ast = parse(source, { positions: true, onParseError: () => undefined });
  } catch {
    return [];
  }

  const notes: TIneffectiveDeclaration[] = [];
  walk(ast, {
    visit: "Declaration",
    enter(cssNode) {
      // Only style rules: @font-face, @property, @counter-style and the like hold descriptors, which are
      // not properties (and are removed with their at-rule anyway).
      if (cssNode.type !== "Declaration" || !this.rule) return;
      const node = cssNode as DeclarationNode;
      const property = node.property.toLowerCase();
      if (property.startsWith("-") || property.includes("\\") || POLICY_PROPERTIES.has(property)) return;
      const location = fromOneBasedLocation(node.loc?.start);
      if (lexer.checkPropertyName(node.property)) {
        notes.push({
          code: "unknown_property",
          reason: `"${node.property}" is not a CSS property, so browsers ignore it. Check the spelling.`,
          location,
        });
        return;
      }
      if (node.value.type === "Raw" || UNCHECKABLE_VALUE.test(generate(node.value))) return;
      const match = lexer.matchProperty(node.property, node.value);
      if (match.error?.name === "SyntaxMatchError") {
        notes.push({
          code: "invalid_value",
          reason: `This value is not valid for "${node.property}", so browsers ignore the declaration.`,
          location,
        });
      }
    },
  });
  return notes;
};
