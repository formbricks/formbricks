import { calledMethodName, findProperty, keyName } from "./ast.mjs";

// Prisma methods that address one row by a unique key. findMany/updateMany/deleteMany take a filter, which
// an `{ id }` alone does not turn into a cross-tenant read of one chosen row.
const SINGLE_ROW_METHODS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "update",
  "delete",
  "upsert",
]);

// The tenant rows themselves. Their id is the tenant the caller was authorized for, so `{ id }` alone is the
// scoping, not a missing one. A user is not a tenant: `{ id: body.userId }` can reach another
// organization's member, so user lookups stay in scope. `creator` and `createdBy` link the acting user.
const TENANT_MODELS = new Set(["workspace", "organization"]);
const TENANT_RELATIONS = new Set([...TENANT_MODELS, "creator", "createdBy"]);

/** `{ id }` or `{ id: x }` and nothing else: no spread, no second key. */
const isIdOnlyObject = (node) =>
  node?.type === "ObjectExpression" &&
  node.properties.length === 1 &&
  node.properties[0].type === "Property" &&
  !node.properties[0].computed &&
  keyName(node.properties[0].key) === "id";

/** `<client>.<model>.<method>(...)`: a Prisma delegate call, not a lookalike on a plain object. */
const isDelegateCall = (node) =>
  node.callee.type === "MemberExpression" && node.callee.object.type === "MemberExpression";

export const tenantScopedWhere = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Scope a single-row Prisma lookup by the authorized workspace or organization, not by id alone.",
    },
    schema: [],
    messages: {
      idOnlyWhere:
        "A caller-supplied id is resolved without its tenant. Put the authorized workspace or organization in the same `where` (`{ id, workspaceId }`); authorizing the parent first is not enough.",
      idOnlyConnect:
        "`connect: { id }` links whatever row the id names. Connect through a compound key that includes the authorized tenant (`connect: { id_workspaceId: … }`), or read the row scoped first.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isDelegateCall(node) || !SINGLE_ROW_METHODS.has(calledMethodName(node))) return;
        if (TENANT_MODELS.has(keyName(node.callee.object.property))) return;
        const where = findProperty(node.arguments[0], "where");
        if (where && isIdOnlyObject(where.value)) {
          context.report({ node: where, messageId: "idOnlyWhere" });
        }
      },
      Property(node) {
        if (node.computed || keyName(node.key) !== "connect" || !isIdOnlyObject(node.value)) return;
        // `workspace: { connect: { id } }`: the property that holds this object names the relation.
        const relation = node.parent?.parent;
        if (relation?.type === "Property" && TENANT_RELATIONS.has(keyName(relation.key))) return;
        context.report({ node, messageId: "idOnlyConnect" });
      },
    };
  },
};
