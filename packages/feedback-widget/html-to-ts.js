import { readFileSync, writeFileSync } from "fs";
import { minify } from "html-minifier-terser";

const html = readFileSync("./src/form.html").toString();

writeFileSync(
  "./src/form-html.ts",
  `export const formHTML = \`${ await minify(html, {
    collapseInlineTagWhitespace: true,
    collapseWhitespace: true,
  })}\`;`
);
