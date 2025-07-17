// packages/js-core/.prettierrc.cjs
const base = require("../config-prettier/prettier-preset");

module.exports = {
    ...base,
    plugins: [
        "@trivago/prettier-plugin-sort-imports",
    ],

    importOrder: [
        "^vitest$",                    // 1️⃣ vitest first
        "<THIRD_PARTY_MODULES>",       // 2️⃣ then other externals
        "^@/.*$",                      // 3️⃣ then anything under @/  
        "^\\.\\/__mocks__\\/.*$",      // 4️⃣ then anything under ./__mocks__/
        "^[./]",                       // 5️⃣ finally all other relative imports
    ],
    importOrderSortSpecifiers: true,
};
