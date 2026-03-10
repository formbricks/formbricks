declare module "prismjs" {
  const Prism: {
    highlightAll: () => void;
    highlightElement: (element: Element) => void;
    highlight: (text: string, grammar: unknown, language: string) => string;
    languages: Record<string, unknown>;
  };
  export default Prism;
}

declare module "prismjs/themes/prism.css";
