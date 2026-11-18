import { calleeName, findDescendants, keyName } from "./ast.mjs";

// Chained calls that state what happens to unknown keys. `.strict()` rejects them; `.passthrough()` and
// `.loose()` keep them, an explicit, reviewable choice (an output schema read from the database must not
// reject new columns). `.strip()` is not here: it is Zod's default, so it would silence the rule for free.
const UNKNOWN_KEY_POLICIES = new Set(["strict", "passthrough", "loose"]);

const isZodObjectCall = (node) =>
  node.callee.type === "MemberExpression" &&
  !node.callee.computed &&
  node.callee.object.type === "Identifier" &&
  node.callee.object.name === "z" &&
  keyName(node.callee.property) === "object";

/** Whether a method chain hanging off `node` (`z.object(…).describe(…).strict()`) sets the key policy. */
const chainSetsKeyPolicy = (node) => {
  let current = node;
  while (current.parent?.type === "MemberExpression" && current.parent.object === current) {
    const member = current.parent;
    if (UNKNOWN_KEY_POLICIES.has(keyName(member.property))) return true;
    if (member.parent?.type !== "CallExpression" || member.parent.callee !== member) return false;
    current = member.parent;
  }
  return false;
};

const isShapeAccess = (node) =>
  node.type === "MemberExpression" && !node.computed && keyName(node.property) === "shape";

export const strictInputObject = {
  meta: {
    type: "problem",
    docs: { description: "API input objects reject unknown keys at every nesting level." },
    schema: [],
    messages: {
      looseObject:
        "Use `z.strictObject(…)` (or `.strict()`) for API input: an unknown key is a 400 at every nesting level, because a dropped typo returns a confidently wrong answer. For a schema that must accept extra keys, say so with `z.looseObject` or `.loose()`.",
      shapeToTool:
        "Passing `.shape` to registerScopedTool rebuilds a loose object and drops `.strict()`. Pass the strict schema itself.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (isZodObjectCall(node) && !chainSetsKeyPolicy(node)) {
          context.report({ node, messageId: "looseObject" });
        }
        if (calleeName(node) === "registerScopedTool") {
          // The tool's definition, not its handler: a handler may read `.shape` for its own reasons.
          for (const argument of node.arguments) {
            for (const shape of findDescendants(argument, isShapeAccess, { skipFunctions: true })) {
              context.report({ node: shape, messageId: "shapeToTool" });
            }
          }
        }
      },
    };
  },
};
