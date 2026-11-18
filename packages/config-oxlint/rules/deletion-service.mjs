import { calledMethodName, keyName } from "./ast.mjs";

const toPosix = (filename) => filename.split("\\").join("/");

export const deletionService = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Rows that own storage, Hub records or invites are deleted only through their deletion service.",
    },
    schema: [
      {
        type: "object",
        description: "Model delegate name → the one file (path suffix) allowed to delete it.",
        additionalProperties: { type: "string" },
      },
    ],
    messages: {
      outsideService:
        "Delete `{{model}}` rows through `{{service}}`. Deleting also removes storage objects (both prefixes), Hub records and pending invites; `ON DELETE CASCADE` reaches only Postgres.",
    },
  },
  create(context) {
    const services = context.options[0] ?? {};
    const filename = toPosix(context.filename);
    return {
      CallExpression(node) {
        const method = calledMethodName(node);
        if (method !== "delete" && method !== "deleteMany") return;
        const delegate = node.callee.object;
        if (delegate.type !== "MemberExpression" || delegate.computed) return;
        const model = keyName(delegate.property);
        const service = Object.hasOwn(services, model) ? services[model] : undefined;
        if (service === undefined || filename.endsWith(`/${service}`)) return;
        context.report({ node, messageId: "outsideService", data: { model, service } });
      },
    };
  },
};
