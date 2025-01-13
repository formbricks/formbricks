import { slugifyWithCounter } from "@sindresorhus/slugify";
import * as acorn from "acorn";
import { toString } from "mdast-util-to-string";
import { mdxAnnotations } from "mdx-annotations";
import { createCssVariablesTheme, createHighlighter } from "shiki";
import { visit } from "unist-util-visit";

let highlighterPromise;
const supportedLanguages = ["javascript", "html", "shell", "tsx", "json", "yml", "ts"];

const myTheme = createCssVariablesTheme({
  name: "css-variables",
  variablePrefix: "--shiki-",
  variableDefaults: {},
  fontStyle: true,
});

const rehypeParseCodeBlocks = () => {
  return (tree) => {
    visit(tree, "element", (node, _nodeIndex, parentNode) => {
      if (node.tagName === "code" && node.properties.className) {
        parentNode.properties.language = node.properties.className[0]?.replace(/^language-/, "");
      }
    });
  };
};


const getHighlighter = async () => {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      langs: supportedLanguages,
      themes: [myTheme],
    })
  }

  return highlighterPromise;
}
const rehypeShiki = () => {
  return async (tree) => {
    const highlighter = await getHighlighter();

    visit(tree, "element", (node) => {
      if (node.tagName === "pre" && node.children[0]?.tagName === "code") {
        let codeNode = node.children[0];
        let textNode = codeNode.children[0];
        if (!codeNode || !textNode) return;
        node.properties.code = textNode.value;
        if (codeNode.properties.className && codeNode.properties.className.length > 0) {
          let lang = codeNode.properties.className[0].replace("language-", "");
          const code = highlighter.codeToHtml(textNode.value, { lang, theme: "css-variables" });
          textNode.value = code;
        }
      }
    });
  };
};

const rehypeSlugify = () => {
  return (tree) => {
    const slugify = slugifyWithCounter();
    visit(tree, "element", (node) => {
      if (["h2", "h3", "h4"].includes(node.tagName) && !node.properties.id) {
        node.properties.id = slugify(toString(node));
      }
    });
  };
};

const rehypeAddMDXExports = (getExports) => {
  return (tree) => {
    let exports = Object.entries(getExports(tree));

    for (let [name, value] of exports) {
      for (let node of tree.children) {
        if (node.type === "mdxjsEsm" && new RegExp(`export\\s+const\\s+${name}\\s*=`).test(node.value)) {
          return;
        }
      }

      let exportStr = `export const ${name} = ${value}`;

      tree.children.push({
        type: "mdxjsEsm",
        value: exportStr,
        data: {
          estree: acorn.parse(exportStr, {
            sourceType: "module",
            ecmaVersion: "latest",
          }),
        },
      });
    }
  };
};

const getSections = (node) => {
  const sections = [];

  for (const child of node.children ?? []) {
    if (child.type === "element" && ["h2", "h3", "h4"].includes(child.tagName)) {
      sections.push(`{
          title: ${JSON.stringify(toString(child))},
          id: ${JSON.stringify(child.properties.id)},
          ...${child.properties.annotation}
        }`);
    } else if (child.children) {
      sections.push(...getSections(child));
    }
  }

  return sections;
};

export const rehypePlugins = [
  mdxAnnotations.rehype,
  rehypeParseCodeBlocks,
  rehypeShiki,
  rehypeSlugify,
  [
    rehypeAddMDXExports,
    (tree) => ({
      sections: `[${getSections(tree).join()}]`,
    }),
  ],
];
