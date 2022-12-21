import { readFileSync, writeFileSync } from "fs";
import { minify } from "html-minifier";

const html = readFileSync("./src/form.html").toString();
writeFileSync(
  "./src/form-html.ts",
  `export const formHTML = \`${minify(html, {
    collapseWhitespace: true,
    collapseInlineTagWhitespace: true,
  })}\`;\n`
);
