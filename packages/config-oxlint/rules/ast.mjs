/* Small AST helpers shared by the formbricks/* rules. Plain ESTree, no type information. */

/** The static name of an object key or member property, or null when it is computed from a value. */
export const keyName = (node) => {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
};

/** The property named `name` of an object literal, ignoring spreads and computed keys. */
export const findProperty = (objectExpression, name) =>
  objectExpression?.type === "ObjectExpression"
    ? objectExpression.properties.find(
        (property) => property.type === "Property" && !property.computed && keyName(property.key) === name
      )
    : undefined;

/** The method name of a call such as `a.b.method(...)`, or null. */
export const calledMethodName = (callExpression) =>
  callExpression.callee.type === "MemberExpression" && !callExpression.callee.computed
    ? keyName(callExpression.callee.property)
    : null;

/** The callee name of `fn(...)`, or of `a.fn(...)`. */
export const calleeName = (callExpression) => {
  const { callee } = callExpression;
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" && !callee.computed) return keyName(callee.property);
  return null;
};

const isFunction = (node) =>
  node.type === "ArrowFunctionExpression" ||
  node.type === "FunctionExpression" ||
  node.type === "FunctionDeclaration";

/** The AST nodes directly under `node`, whatever keys hold them. */
const childNodes = (node) =>
  Object.entries(node)
    .filter(([key, value]) => key !== "parent" && value !== null && typeof value === "object")
    .flatMap(([, value]) => (Array.isArray(value) ? value : [value]));

const isNode = (value) => typeof value?.type === "string";

/**
 * Every descendant of `root` (itself included) that `match` accepts, depth first. With `skipFunctions`
 * the walk does not enter function bodies, so a callback passed alongside a value is not searched.
 */
export const findDescendants = (root, match, { skipFunctions = false } = {}) => {
  const found = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!isNode(node) || (skipFunctions && isFunction(node))) continue;
    if (match(node)) found.push(node);
    else stack.push(...childNodes(node));
  }
  return found;
};

/** Strips TS-only wrappers (`x as T`, `x!`, `x satisfies T`) so a rule sees the value. */
export const unwrapExpression = (node) => {
  let current = node;
  while (
    current &&
    (current.type === "TSAsExpression" ||
      current.type === "TSNonNullExpression" ||
      current.type === "TSSatisfiesExpression")
  ) {
    current = current.expression;
  }
  return current;
};
