import { keyName } from "./ast.mjs";

/** The name a comparison's operand goes by: `role`, or the property in `membership.role`. */
const operandName = (node) => {
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression" && !node.computed) return keyName(node.property);
  return null;
};

const literalString = (node) =>
  node.type === "Literal" && typeof node.value === "string" ? node.value : null;

export const gatePredicate = {
  meta: {
    type: "problem",
    docs: {
      description:
        "A gate is one function every entry point calls; comparing against its values elsewhere is a second copy.",
    },
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          operand: { type: "string", description: "Regex for the compared name (`role`, `status`)." },
          values: { type: "array", items: { type: "string" } },
          gate: { type: "string", description: "The gate function to call instead." },
        },
        required: ["operand", "values", "gate"],
        additionalProperties: false,
      },
    },
    messages: {
      secondCopy:
        '`{{operand}} {{operator}} "{{value}}"` is a second copy of a gate predicate. Call `{{gate}}` instead, so every entry point applies the same rule.',
    },
  },
  create(context) {
    const gates = context.options.map((gate) => ({ ...gate, operand: new RegExp(gate.operand) }));
    if (gates.length === 0) return {};
    return {
      BinaryExpression(node) {
        if (!["===", "!==", "==", "!="].includes(node.operator)) return;
        for (const [subject, other] of [
          [node.left, node.right],
          [node.right, node.left],
        ]) {
          const value = literalString(other);
          const name = operandName(subject);
          if (value === null || name === null) continue;
          const gate = gates.find(
            (candidate) => candidate.operand.test(name) && candidate.values.includes(value)
          );
          if (gate) {
            context.report({
              node,
              messageId: "secondCopy",
              data: { operand: name, operator: node.operator, value, gate: gate.gate },
            });
            return;
          }
        }
      },
    };
  },
};
