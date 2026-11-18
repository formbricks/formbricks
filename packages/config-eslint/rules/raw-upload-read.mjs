import { calledMethodName } from "./ast.mjs";

const UNBOUNDED_READS = new Set(["formData", "arrayBuffer", "blob"]);
const REQUEST_NAME = /^(req|request)$/;

export const rawUploadRead = {
  meta: {
    type: "problem",
    docs: {
      description: "Request bodies are read through the bounded helpers in app/lib/api/request-body.ts.",
    },
    schema: [],
    messages: {
      unbounded:
        "`{{method}}()` buffers the whole body. Read it with `@/app/lib/api/request-body` (parseFormDataWithLimit, readRequestBytesWithLimit): `Content-Length` checked, the stream capped (413). For uploads, tell the type from magic bytes (415) and treat the filename as display text only.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const method = calledMethodName(node);
        if (!UNBOUNDED_READS.has(method)) return;
        const { object } = node.callee;
        if (object.type === "Identifier" && REQUEST_NAME.test(object.name)) {
          context.report({ node, messageId: "unbounded", data: { method } });
        }
      },
    };
  },
};
