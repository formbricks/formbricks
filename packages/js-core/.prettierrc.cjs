// packages/js-core/.prettierrc.cjs
const base = require("../config-prettier/prettier-preset");

module.exports = {
    ...base,
    plugins: [
        "@trivago/prettier-plugin-sort-imports",
        "prettier-plugin-tailwindcss",
        "prettier-plugin-sort-json",
    ],

    importOrder: [
        "^vitest$",                    // 1️⃣ vitest first
        "<THIRD_PARTY_MODULES>",       // 2️⃣ then other externals
        "^\\.\\/__mocks__\\/.*$",      // 3️⃣ then anything under ./__mocks__/
        "^[./]",                       // 4️⃣ finally all other relative imports
    ],
    importOrderSortSpecifiers: true,
    jsonRecursiveSort: true,
};
