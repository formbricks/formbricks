// css-tree ships no type declarations; only the part of its API the custom CSS processor uses.
declare module "css-tree" {
  interface CssLocation {
    start: { line: number; column: number };
  }
  export interface CssNode {
    type: string;
    loc?: CssLocation | null;
    [key: string]: unknown;
  }
  export interface DeclarationNode extends CssNode {
    type: "Declaration";
    property: string;
    value: CssNode;
  }
  export function parse(
    source: string,
    options?: { positions?: boolean; context?: string; onParseError?: (error: unknown) => void }
  ): CssNode;
  export function generate(node: CssNode): string;
  export const walk: {
    (
      ast: CssNode,
      options: {
        visit?: string;
        /** Returning `walk.break` stops the walk. */
        enter: (this: { rule: CssNode | null; atrule: CssNode | null }, node: CssNode) => symbol | void;
      }
    ): void;
    readonly break: symbol;
  };
  export const lexer: {
    checkPropertyName(name: string): Error | undefined;
    matchProperty(name: string, value: CssNode): { error: (Error & { name: string }) | null };
  };
}
