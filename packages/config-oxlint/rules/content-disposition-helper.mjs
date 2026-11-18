import { calledMethodName, calleeName, keyName, unwrapExpression } from "./ast.mjs";

const HEADER = /^content-disposition$/i;
// The shared builder (`@/lib/utils/content-disposition`) and the archive export's named wrapper of it.
const HELPERS = new Set(["buildAttachmentContentDisposition", "buildAttachmentArchiveContentDisposition"]);

const isHelperCall = (node) => {
  const value = unwrapExpression(node);
  return value?.type === "CallExpression" && HELPERS.has(calleeName(value));
};

export const contentDispositionHelper = {
  meta: {
    type: "problem",
    docs: { description: "Content-Disposition headers are built by the shared helper." },
    schema: [],
    messages: {
      handBuilt:
        "Build `Content-Disposition` with `buildAttachmentContentDisposition` (`@/lib/utils/content-disposition`): it writes an RFC 6266/8187 `filename*` with an ASCII fallback and a name safe on every file system. Send it with the exact `Content-Type`, `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`.",
    },
  },
  create(context) {
    return {
      Property(node) {
        if (node.computed || !HEADER.test(keyName(node.key) ?? "")) return;
        if (!isHelperCall(node.value)) context.report({ node, messageId: "handBuilt" });
      },
      CallExpression(node) {
        const method = calledMethodName(node);
        if (method !== "set" && method !== "append") return;
        const [name, value] = node.arguments;
        if (!HEADER.test(keyName(name) ?? "")) return;
        if (!isHelperCall(value)) context.report({ node, messageId: "handBuilt" });
      },
    };
  },
};
