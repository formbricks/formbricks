import { slugifyWithCounter } from "@sindresorhus/slugify";
import * as acorn from "acorn";
import { toString } from "mdast-util-to-string";
import { mdxAnnotations } from "mdx-annotations";
import { getHighlighter, renderToHtml } from "shiki";
import { visit } from "unist-util-visit";

const rehypeParseCodeBlocks = () => {
  return (tree) => {
    visit(tree, "element", (node, _nodeIndex, parentNode) => {
      if (node.tagName === "code" && node.properties.className) {
        parentNode.properties.language = node.properties.className[0]?.replace(/^language-/, "");
      }
    });
  };
};

let highlighter;

const rehypeShiki = () => {
  return async (tree) => {
    highlighter = highlighter ?? (await getHighlighter({ theme: "css-variables" }));

    visit(tree, "element", (node) => {
      if (node.tagName === "pre" && node.children[0]?.tagName === "code") {
        let codeNode = node.children[0];
        let textNode = codeNode.children[0];

        node.properties.code = textNode.value;

        if (node.properties.language) {
          let tokens = highlighter.codeToThemedTokens(textNode.value, node.properties.language);

          textNode.value = renderToHtml(tokens, {
            elements: {
              pre: ({ children }) => children,
              code: ({ children }) => children,
              line: ({ children }) => `<span>${children}</span>`,
            },
          });
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
