import { readFileSync, writeFileSync } from "node:fs";
import tailwind from "/home/user/formbricks/node_modules/@tailwindcss/postcss/dist/index.mjs";
import postcss from "/home/user/formbricks/node_modules/postcss/lib/postcss.mjs";

const here = new URL(".", import.meta.url).pathname;
const entry = `${here}entry.css`;

const result = await postcss([tailwind()]).process(
  readFileSync(entry, "utf8"),
  { from: entry },
);
writeFileSync(`${here}out.css`, result.css);
console.log("css bytes:", result.css.length);
