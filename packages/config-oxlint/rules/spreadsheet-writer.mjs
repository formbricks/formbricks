import { keyName } from "./ast.mjs";

// The calls that produce a spreadsheet or CSV a user opens. Reading (`xlsx.read`, `Papa.parse`) is fine.
const XLSX_WRITERS = new Set([
  "json_to_sheet",
  "aoa_to_sheet",
  "sheet_add_json",
  "sheet_add_aoa",
  "write",
  "writeFile",
  "writeFileXLSX",
  "writeXLSX",
]);
const PAPAPARSE_WRITERS = new Set(["unparse"]);
const WRITERS_BY_MODULE = { xlsx: XLSX_WRITERS, papaparse: PAPAPARSE_WRITERS };

/** The leftmost identifier of `a.b.c(...)` and the last property name. */
const callPath = (callee) => {
  if (callee.type === "Identifier") return { root: callee.name, last: callee.name };
  if (callee.type !== "MemberExpression" || callee.computed) return null;
  let object = callee.object;
  while (object.type === "MemberExpression") object = object.object;
  return object.type === "Identifier" ? { root: object.name, last: keyName(callee.property) } : null;
};

export const spreadsheetWriter = {
  meta: {
    type: "problem",
    docs: { description: "Spreadsheets and CSVs are written only through file-conversion.ts." },
    schema: [],
    messages: {
      writer:
        "Write spreadsheets and CSVs through `@/lib/utils/file-conversion` (convertToCsv, convertToXlsxBuffer, toCsvLine). Every cell passes through sanitizeFormulaInjection there, so a respondent's `=HYPERLINK(…)` is never evaluated when the file opens.",
    },
  },
  create(context) {
    // Local name → the writer set of the module it was imported from.
    const bindings = new Map();
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source === "string" && source.startsWith("@json2csv/")) {
          context.report({ node, messageId: "writer" });
          return;
        }
        const writers = WRITERS_BY_MODULE[source];
        if (!writers) return;
        for (const specifier of node.specifiers) bindings.set(specifier.local.name, writers);
      },
      CallExpression(node) {
        const path = callPath(node.callee);
        if (!path) return;
        const writers = bindings.get(path.root);
        if (writers?.has(path.last)) context.report({ node, messageId: "writer" });
      },
    };
  },
};
