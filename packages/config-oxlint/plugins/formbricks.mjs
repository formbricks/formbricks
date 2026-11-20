/*
 * Formbricks' own oxlint JS plugin. oxlint has no `no-restricted-syntax`, so the repo's selector-based
 * guardrails (direct `process.env` reads in apps/web, markup-parsing APIs in code that runs on customer
 * pages) run through `formbricks/restricted-syntax`, which takes the same `{ selector, message }` options
 * ESLint's rule did. oxlint JS plugins support ESLint selector syntax, so the selectors carry over as-is.
 *
 * A line that has to use a restricted API disables the rule with the reason it is safe:
 *   // oxlint-disable-next-line formbricks/restricted-syntax -- <reason>
 *
 * `formbricks/no-inline-lint-config` reports ESLint's inline configuration comments, which oxlint
 * ignores without a warning: a rule configured that way silently does nothing.
 *
 * `formbricks/prefer-read-only-props` replaces eslint-plugin-react's rule of the same name, whose
 * component detection cost about half of apps/web's lint run (ENG-7401).
 */

const restrictedSyntax = {
  meta: {
    type: "problem",
    docs: { description: "Disallow syntax matched by the configured ESLint selectors." },
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: { selector: { type: "string" }, message: { type: "string" } },
        required: ["selector"],
        additionalProperties: false,
      },
      uniqueItems: true,
    },
  },
  create(context) {
    const visitors = {};
    for (const { selector, message } of context.options) {
      const report = (node) =>
        context.report({ node, message: message ?? `Using '${selector}' is not allowed.` });
      const previous = visitors[selector];
      visitors[selector] = previous
        ? (node) => {
            previous(node);
            report(node);
          }
        : report;
    }
    return visitors;
  },
};

// `/* eslint <rule>: … */`, `/* eslint-env */`, `/* global(s) */` and `/* exported */`, as ESLint reads
// them. Disable and enable directives (`eslint-disable…`, `eslint-enable…`), which oxlint honours, do
// not match.
const INLINE_CONFIG = /^\s*(eslint(?:-env)?|globals?|exported)(?:\s|$)/;

const noInlineLintConfig = {
  meta: {
    type: "problem",
    docs: { description: "Disallow ESLint inline configuration comments, which oxlint ignores." },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const match = comment.type === "Block" ? INLINE_CONFIG.exec(comment.value) : null;
          if (!match) continue;
          context.report({
            loc: comment.loc,
            message: `oxlint ignores \`/* ${match[1]} */\` comments, so this configures nothing. Set the rule, environment or global in the workspace's oxlint.config.ts, in an override scoped to this file if needed.`,
          });
        }
      },
    };
  },
};

/*
 * `prefer-read-only-props`: every prop a component declares is read-only. It resolves props as
 * eslint-plugin-react 7.37 did, without its component detection:
 * - A component is a function that returns JSX or `null`, optionally through `memo`/`forwardRef`:
 *   named in PascalCase (declared, a named function expression, a variable or an object key), or
 *   the anonymous default export. A class extending `Component`/`PureComponent` is one too.
 * - Its props type is a wrapper's type argument (`forwardRef<Ref, Props>`'s second), else the first
 *   parameter's annotation (default value or not), else the `FC<Props>`-style annotation of its
 *   variable; for a class, its first type argument and the annotation of its `props` field.
 * - That type resolves through type literals, intersections, the React generics (`FC`,
 *   `PropsWithChildren`, …) and the interfaces and type aliases declared in the same file. A type
 *   imported from elsewhere, or wrapped in `Readonly<>`, is not looked into, so `Readonly<Props>`
 *   passes.
 * - Unlike eslint-plugin-react, it does not follow a returned variable (`const el = <div />;
 *   return el;`) to see that the function returns JSX.
 * Each property signature found without `readonly` is reported. There is no autofix:
 * CODING_STANDARDS.md asks for the `Readonly<Props>` wrapper, not `readonly` members.
 */
const PROPS_TYPE_ARGUMENT = {
  ComponentProps: 0,
  ComponentPropsWithRef: 0,
  ComponentPropsWithoutRef: 0,
  ForwardRefRenderFunction: 1,
  VoidFunctionComponent: 0,
  VFC: 0,
  PropsWithChildren: 0,
  SFC: 0,
  StatelessComponent: 0,
  FunctionComponent: 0,
  FC: 0,
};
// The call wrappers a component passes through, and which of their type arguments is the props type.
const WRAPPERS = { memo: 0, forwardRef: 1 };
const COMPONENT_CLASSES = new Set(["Component", "PureComponent"]);
const PASCAL_CASE = /^[A-Z]/;

const typeArgumentsOf = (node) => node.typeArguments?.params ?? [];

const isFunction = (node) =>
  node?.type === "ArrowFunctionExpression" ||
  node?.type === "FunctionExpression" ||
  node?.type === "FunctionDeclaration";

const isJsx = (node) => {
  switch (node?.type) {
    case "JSXElement":
    case "JSXFragment":
      return true;
    case "Literal":
      return node.value === null && node.raw === "null";
    case "ConditionalExpression":
      return isJsx(node.consequent) || isJsx(node.alternate);
    case "LogicalExpression":
      return isJsx(node.left) || isJsx(node.right);
    case "ParenthesizedExpression":
    case "TSAsExpression":
    case "TSNonNullExpression":
      return isJsx(node.expression);
    default:
      return false;
  }
};

// Whether a function returns JSX or `null` from its own body, not from a nested function.
const returnsJsx = (fn) => {
  if (fn.body?.type !== "BlockStatement") return isJsx(fn.body);
  const visit = (node) => {
    if (!node || typeof node.type !== "string") return false;
    if (node.type === "ReturnStatement") return isJsx(node.argument);
    if (isFunction(node) || node.type === "ClassDeclaration" || node.type === "ClassExpression") {
      return false;
    }
    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      const child = node[key];
      if (Array.isArray(child)) {
        if (child.some(visit)) return true;
      } else if (child && typeof child === "object" && visit(child)) {
        return true;
      }
    }
    return false;
  };
  return visit(fn.body);
};

const preferReadOnlyProps = {
  meta: {
    type: "suggestion",
    docs: { description: "Enforce that component props are read-only." },
    schema: [],
  },
  create(context) {
    // Names that refer to React: namespace/default imports, and `FC`-style generics under their local name.
    const reactNamespaces = new Set();
    const reactGenerics = new Map();
    // Local name → imported name, so `forwardRef as fwd` still reads its second type argument.
    const reactWrappers = new Map();
    const reactClasses = new Set();
    const declarations = new Map();
    const reported = new Set();

    // The React generic (`FC`, `React.PropsWithChildren`, …) a type name refers to, if any.
    const reactGenericOf = (name) => {
      if (name?.type === "Identifier") return reactGenerics.get(name.name);
      if (name?.type === "TSQualifiedName" && reactNamespaces.has(name.left?.name)) {
        return Object.hasOwn(PROPS_TYPE_ARGUMENT, name.right.name) ? name.right.name : undefined;
      }
      return undefined;
    };

    // Collects into `members` the property signatures a props type declares in this file.
    const resolve = (node, members, seen) => {
      switch (node?.type) {
        case "TSTypeAnnotation":
        case "TSParenthesizedType":
          resolve(node.typeAnnotation, members, seen);
          return;
        case "TSTypeLiteral":
          members.push(...node.members);
          return;
        case "TSIntersectionType":
          for (const type of node.types) resolve(type, members, seen);
          return;
        case "TSTypeReference":
        case "TSInterfaceHeritage":
        case "TSClassImplements":
          resolveReference(node, members, seen);
          return;
        default:
      }
    };

    const resolveReference = (node, members, seen) => {
      const name = node.typeName ?? node.expression;
      const generic = reactGenericOf(name);
      if (generic !== undefined) {
        resolve(typeArgumentsOf(node)[PROPS_TYPE_ARGUMENT[generic]], members, seen);
        return;
      }
      if (name?.type !== "Identifier" || seen.has(name.name)) return;
      seen.add(name.name);
      for (const declaration of declarations.get(name.name) ?? []) {
        if (declaration.type === "TSTypeAliasDeclaration") {
          resolve(declaration.typeAnnotation, members, seen);
          continue;
        }
        members.push(...declaration.body.body);
        for (const heritage of declaration.extends ?? []) resolve(heritage, members, seen);
      }
    };

    const check = (propsType) => {
      if (!propsType) return;
      const members = [];
      resolve(propsType, members, new Set());
      for (const member of members) {
        if (member.type !== "TSPropertySignature" || member.readonly || reported.has(member)) continue;
        reported.add(member);
        const name =
          member.key.type === "Identifier" ? member.key.name : String(member.key.value ?? member.key.raw);
        context.report({
          node: member,
          message: `Prop '${name}' should be read-only. Wrap the props type in \`Readonly<>\`.`,
        });
      }
    };

    // `({ a }: Props)`, `(props: Props)`, or either with a default value (`… = {}`).
    const propsOfFunction = (fn) => {
      const param = fn.params[0];
      return (param?.type === "AssignmentPattern" ? param.left : param)?.typeAnnotation;
    };

    const isWrapperCall = (node) => {
      if (node?.type !== "CallExpression") return false;
      const { callee } = node;
      if (callee.type === "Identifier") return reactWrappers.has(callee.name);
      return (
        callee.type === "MemberExpression" &&
        reactNamespaces.has(callee.object.name) &&
        Object.hasOwn(WRAPPERS, callee.property.name)
      );
    };

    // `memo(forwardRef<Ref, Props>((props, ref) => …))`: the innermost function and the props type
    // the wrappers' type arguments give, if any.
    const unwrap = (node) => {
      let propsType;
      let current = node;
      while (isWrapperCall(current)) {
        const { callee } = current;
        const name = callee.type === "Identifier" ? reactWrappers.get(callee.name) : callee.property.name;
        const typeArgument = typeArgumentsOf(current)[WRAPPERS[name]];
        propsType ??= typeArgument;
        current = current.arguments[0];
      }
      return { fn: isFunction(current) ? current : undefined, propsType };
    };

    const components = [];
    // Functions already checked through `addComponent`, whose props type may come from a wrapper.
    const wrapped = new Set();

    // A function component, possibly wrapped: a wrapper's type argument names the props before the
    // parameter's annotation does, then the annotation of the variable it is assigned to.
    const addComponent = (init, annotation) => {
      const { fn, propsType } = unwrap(init);
      if (!fn || !returnsJsx(fn)) return;
      wrapped.add(fn);
      components.push(() => check(propsType ?? propsOfFunction(fn) ?? annotation));
    };

    return {
      ImportDeclaration(node) {
        if (node.source.value !== "react") return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") {
            reactNamespaces.add(specifier.local.name);
            continue;
          }
          const imported = specifier.imported.name ?? specifier.imported.value;
          if (Object.hasOwn(PROPS_TYPE_ARGUMENT, imported)) reactGenerics.set(specifier.local.name, imported);
          if (Object.hasOwn(WRAPPERS, imported)) reactWrappers.set(specifier.local.name, imported);
          if (COMPONENT_CLASSES.has(imported)) reactClasses.add(specifier.local.name);
        }
      },
      "TSInterfaceDeclaration, TSTypeAliasDeclaration"(node) {
        // Only top-level declarations (exported or not), as eslint-plugin-react resolved them.
        const parent = node.parent?.type === "ExportNamedDeclaration" ? node.parent.parent : node.parent;
        if (parent?.type !== "Program") return;
        const list = declarations.get(node.id.name) ?? [];
        list.push(node);
        declarations.set(node.id.name, list);
      },
      "FunctionDeclaration, FunctionExpression"(node) {
        if (node.id && PASCAL_CASE.test(node.id.name) && returnsJsx(node)) {
          // `forwardRef<Ref, Props>(function Hello(…) {…})` is checked against the wrapper's type.
          components.push(() => {
            if (!wrapped.has(node)) check(propsOfFunction(node));
          });
        }
      },
      VariableDeclarator(node) {
        if (node.id.type !== "Identifier" || !PASCAL_CASE.test(node.id.name)) return;
        addComponent(node.init, node.id.typeAnnotation);
      },
      // `export default function ({ a }: Props)`, `export default (props: Props) => …`.
      ExportDefaultDeclaration(node) {
        const { declaration } = node;
        if (declaration.type !== "FunctionDeclaration" || !declaration.id) addComponent(declaration);
      },
      // `{ Heading: ({ a }: Props) => <h1>{a}</h1> }`.
      Property(node) {
        const name = node.key.type === "Identifier" ? node.key.name : node.key.value;
        if (!node.computed && typeof name === "string" && PASCAL_CASE.test(name)) addComponent(node.value);
      },
      "ClassDeclaration, ClassExpression"(node) {
        const superClass = node.superClass;
        const isComponent =
          (superClass?.type === "Identifier" && reactClasses.has(superClass.name)) ||
          (superClass?.type === "MemberExpression" &&
            reactNamespaces.has(superClass.object.name) &&
            COMPONENT_CLASSES.has(superClass.property.name));
        if (!isComponent) return;
        const typeArgument = node.superTypeArguments?.params?.[0];
        // `props: Props` or `declare props: Props` in the class body declares the props too.
        const propsField = node.body.body.find(
          (member) => member.type === "PropertyDefinition" && !member.static && member.key.name === "props"
        );
        components.push(() => {
          check(typeArgument);
          check(propsField?.typeAnnotation);
        });
      },
      // Type declarations may follow the component that uses them, so props resolve at the end.
      "Program:exit"() {
        for (const run of components) run();
      },
    };
  },
};

/*
 * Taint tracking for `no-request-regexp` (ENG-7450). A JS plugin sees one file at a time, so a value
 * is followed only inside the file: through variables, destructuring, object spreads, closures, and
 * the parameters of a function the file declares and calls with it (`helper(tainted)`, `.action(fn)`,
 * `rows.map(check)`). A source in one file and a sink in another is not reported.
 *
 * A label says what is tainted: `false` (nothing), `true` (the whole value) or an object whose keys
 * label the value's properties (`{ parsedInput: true }` for a server action's first argument).
 */
const EXPRESSION_WRAPPERS = new Set([
  "ChainExpression",
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
]);
const FUNCTION_TYPES = new Set(["ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression"]);
const BLOCK_SCOPES = new Set(["BlockStatement", "ForStatement", "StaticBlock", "SwitchStatement"]);
// Type positions hold no values; skipping them keeps the walk cheap.
const TYPE_KEYS = new Set(["parent", "returnType", "typeAnnotation", "typeArguments", "typeParameters"]);
// A same-file call can taint a function visited earlier, so the walk repeats until the labels settle.
const MAX_TAINT_PASSES = 8;

const unwrapExpression = (node) => {
  let current = node;
  while (current && EXPRESSION_WRAPPERS.has(current.type)) current = current.expression;
  return current;
};

const keyOf = (node) => {
  if (!node.computed) return node.key?.name ?? node.property?.name ?? node.key?.value;
  const key = node.key ?? node.property;
  return key?.type === "Literal" ? key.value : undefined;
};

// Merges per key at every depth, so a wider taint from one call site never hides behind a narrower one.
const union = (a, b) => {
  if (a === true || b === true) return true;
  if (!a) return b;
  if (!b) return a;
  const merged = { ...a };
  for (const [key, value] of Object.entries(b)) merged[key] = union(merged[key], value);
  return merged;
};

const memberLabel = (label, key, deep) => {
  if (label === true) return deep;
  if (label && key !== undefined && Object.hasOwn(label, key)) return label[key];
  return false;
};

const unionLabels = (a = [], b = []) =>
  Array.from({ length: Math.max(a.length, b.length) }, (_, index) => union(a[index], b[index]) || false);

const sameLabels = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const newScope = (isFunction) => ({ vars: new Map(), fns: new Map(), isFunction });

// `export function f` / `export const f = …` declare `f` like the unwrapped statement.
const declarationOf = (statement) =>
  statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration"
    ? statement.declaration
    : statement;

/*
 * Walks `program` and calls `policy.sink(node, labelOf)` on every call and `new` expression, once the
 * labels have settled. `policy` decides what is a source:
 * - `deep`: a property of a tainted value is tainted.
 * - `strings`: a template, a concatenation or a string method carries the taint of its operands.
 * - `callLabel(node, labelOf)`: the label of a call's result, for sources (`req.json()`) and
 *   pass-throughs (`schema.parse(tainted)`).
 * - `paramLabels(fn)`: labels every function's parameters start with.
 * - `callbackLabels(node, labelOf, setParams)`: for a call, the labels of the parameters of a function
 *   among its arguments (a `.map` callback).
 */
function walkTaint(program, policy) {
  // Labels the file's own calls pass to each function it declares, kept across passes.
  const calledWith = new Map();
  let changed = false;
  let reporting = false;

  const pass = () => {
    const scopes = [newScope(true)];
    const presetParams = new Map();

    const scopeOf = (name) => {
      for (let index = scopes.length - 1; index >= 0; index -= 1) {
        if (scopes[index].vars.has(name) || scopes[index].fns.has(name)) return scopes[index];
      }
      return undefined;
    };
    const lookup = (name) => scopeOf(name)?.vars.get(name) ?? false;
    const assign = (name, label) => scopeOf(name)?.vars.set(name, label);
    const functionNamed = (expression) => {
      const node = unwrapExpression(expression);
      if (node?.type !== "Identifier") return undefined;
      return scopeOf(node.name)?.fns.get(node.name);
    };
    const passTo = (fn, labels) => {
      const merged = unionLabels(calledWith.get(fn), labels);
      if (sameLabels(merged, calledWith.get(fn) ?? [])) return;
      calledWith.set(fn, merged);
      changed = true;
    };
    // An inline function takes the labels for this pass; a named one through `calledWith`.
    const setParams = (fn, labels) => {
      const node = unwrapExpression(fn);
      if (node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression") {
        presetParams.set(node, labels);
        return;
      }
      const named = functionNamed(node);
      if (named) passTo(named, labels);
    };

    const labelOf = (expression) => {
      const node = unwrapExpression(expression);
      switch (node?.type) {
        case "Identifier":
          return lookup(node.name);
        case "MemberExpression": {
          const key = keyOf(node);
          // A length is a number, not a pattern.
          if (key === "length") return false;
          return memberLabel(labelOf(node.object), key, policy.deep);
        }
        case "AwaitExpression":
          return labelOf(node.argument);
        case "AssignmentExpression":
          return labelOf(node.right);
        case "SequenceExpression":
          return labelOf(node.expressions.at(-1));
        case "ConditionalExpression":
          return union(labelOf(node.consequent), labelOf(node.alternate));
        case "LogicalExpression":
          return union(labelOf(node.left), labelOf(node.right));
        case "ObjectExpression": {
          let label = false;
          for (const property of node.properties) {
            if (property.type === "SpreadElement") {
              label = union(label, labelOf(property.argument));
              continue;
            }
            const value = labelOf(property.value);
            const key = keyOf(property);
            if (value && key !== undefined && label !== true) label = union(label, { [key]: value });
          }
          return label;
        }
        case "TemplateLiteral":
          return policy.strings && node.expressions.some((part) => labelOf(part) === true);
        case "BinaryExpression":
          return (
            policy.strings &&
            node.operator === "+" &&
            (labelOf(node.left) === true || labelOf(node.right) === true)
          );
        case "ArrayExpression":
          return (
            policy.deep &&
            node.elements.some((element) => element && labelOf(element.argument ?? element) === true)
          );
        case "CallExpression":
          return policy.callLabel(node, labelOf) || false;
        default:
          return false;
      }
    };

    // `var` belongs to the enclosing function, `let` and `const` to the block.
    const declareIn = (kind) => {
      const scope = kind === "var" ? scopes.findLast((candidate) => candidate.isFunction) : scopes.at(-1);
      return (name, label) => scope.vars.set(name, label);
    };
    const bind = (pattern, label, set) => {
      switch (pattern?.type) {
        case "Identifier":
          set(pattern.name, label);
          return;
        case "ObjectPattern":
          for (const property of pattern.properties) {
            if (property.type === "RestElement") bind(property.argument, label, set);
            else bind(property.value, memberLabel(label, keyOf(property), policy.deep), set);
          }
          return;
        case "ArrayPattern":
          pattern.elements.forEach((element, index) => {
            if (element?.type === "RestElement")
              bind(element.argument, label === true ? policy.deep : false, set);
            else bind(element, memberLabel(label, index, policy.deep), set);
          });
          return;
        case "AssignmentPattern":
          bind(pattern.left, union(label, labelOf(pattern.right)), set);
          return;
        case "RestElement":
          bind(pattern.argument, label, set);
          return;
        case "TSParameterProperty":
          bind(pattern.parameter, label, set);
          return;
        default:
      }
    };

    // Function declarations and function-valued `const`s are callable before their line is reached.
    const hoistDeclaration = (declaration, scope) => {
      if (declaration?.type === "FunctionDeclaration" && declaration.id) {
        scope.fns.set(declaration.id.name, declaration);
        return;
      }
      if (declaration?.type !== "VariableDeclaration") return;
      const target =
        declaration.kind === "var" ? scopes.findLast((candidate) => candidate.isFunction) : scope;
      for (const declarator of declaration.declarations) {
        const init = unwrapExpression(declarator.init);
        if (declarator.id.type === "Identifier" && FUNCTION_TYPES.has(init?.type)) {
          target.fns.set(declarator.id.name, init);
        }
      }
    };
    const hoist = (statements) => {
      const scope = scopes.at(-1);
      for (const statement of statements ?? []) hoistDeclaration(declarationOf(statement), scope);
    };

    const visitChildren = (node) => {
      for (const key of Object.keys(node)) {
        if (TYPE_KEYS.has(key)) continue;
        const child = node[key];
        if (Array.isArray(child)) for (const item of child) visit(item);
        else if (child && typeof child.type === "string") visit(child);
      }
    };

    const visitFunction = (fn) => {
      const labels = unionLabels(presetParams.get(fn) ?? policy.paramLabels?.(fn) ?? [], calledWith.get(fn));
      scopes.push(newScope(true));
      const set = declareIn("let");
      fn.params.forEach((param, index) => {
        if (param.type === "AssignmentPattern") visit(param.right);
        bind(param, labels[index] ?? false, set);
      });
      if (fn.body?.type === "BlockStatement") {
        hoist(fn.body.body);
        fn.body.body.forEach(visit);
      } else {
        visit(fn.body);
      }
      scopes.pop();
    };

    const visitLoop = (node) => {
      visit(node.right);
      scopes.push(newScope(false));
      const label = labelOf(node.right);
      // `for (const x of tainted)` yields its elements; `for (const k in tainted)` its keys.
      const element = label === true ? policy.deep : false;
      if (node.left.type === "VariableDeclaration") {
        bind(node.left.declarations[0].id, element, declareIn(node.left.kind));
      } else if (node.left.type === "Identifier") {
        assign(node.left.name, element);
      }
      visit(node.body);
      scopes.pop();
    };

    const visitDeclaration = (node) => {
      const set = declareIn(node.kind);
      for (const declarator of node.declarations) {
        visit(declarator.init);
        bind(declarator.id, labelOf(declarator.init), set);
      }
    };

    const visitAssignment = (node) => {
      visit(node.right);
      if (node.left.type === "Identifier") {
        const right = labelOf(node.right);
        assign(node.left.name, node.operator === "=" ? right : union(lookup(node.left.name), right));
      } else if (node.left.type === "ObjectPattern" || node.left.type === "ArrayPattern") {
        bind(node.left, labelOf(node.right), assign);
      } else {
        visit(node.left);
      }
    };

    const visitCall = (node) => {
      policy.callbackLabels?.(node, labelOf, setParams);
      visitChildren(node);
      const callee = node.type === "CallExpression" ? functionNamed(node.callee) : undefined;
      if (callee) {
        const labels = node.arguments.map((argument) =>
          argument.type === "SpreadElement" ? false : labelOf(argument)
        );
        passTo(callee, labels);
      }
      if (reporting) policy.sink(node, labelOf);
    };

    function visit(node) {
      if (!node || typeof node.type !== "string") return;
      switch (node.type) {
        case "ArrowFunctionExpression":
        case "FunctionExpression":
        case "FunctionDeclaration":
          visitFunction(node);
          return;
        case "VariableDeclaration":
          visitDeclaration(node);
          return;
        case "AssignmentExpression":
          visitAssignment(node);
          return;
        case "CatchClause":
          scopes.push(newScope(false));
          bind(node.param, false, declareIn("let"));
          visit(node.body);
          scopes.pop();
          return;
        case "ForOfStatement":
        case "ForInStatement":
          visitLoop(node);
          return;
        case "CallExpression":
        case "NewExpression":
          visitCall(node);
          return;
        default:
      }
      const scoped = BLOCK_SCOPES.has(node.type);
      if (scoped) {
        scopes.push(newScope(false));
        if (node.type === "BlockStatement") hoist(node.body);
      }
      visitChildren(node);
      if (scoped) scopes.pop();
    }

    hoist(program.body);
    program.body.forEach(visit);
  };

  for (let index = 0; index < MAX_TAINT_PASSES; index += 1) {
    changed = false;
    pass();
    if (!changed) break;
  }
  reporting = true;
  pass();
}

const calleeName = (node) => {
  const callee = unwrapExpression(node.callee);
  if (callee?.type === "Identifier") return callee.name;
  return callee?.type === "MemberExpression" ? keyOf(callee) : undefined;
};

const calleeObject = (node) => {
  const callee = unwrapExpression(node.callee);
  return callee?.type === "MemberExpression" ? callee.object : undefined;
};

// A rule's `allow` option: repo-relative paths of the files that predate it.
const isAllowlisted = (context) => {
  const filename = context.filename.replaceAll("\\", "/");
  const allow = context.options[0]?.allow ?? [];
  return allow.some((entry) => filename.endsWith(`/${entry}`));
};

const ALLOW_OPTION_SCHEMA = [
  {
    type: "object",
    properties: { allow: { type: "array", items: { type: "string" }, uniqueItems: true } },
    additionalProperties: false,
  },
];

/*
 * `no-loose-schema` (ENG-7127): a zod schema open to unknown keys (`.loose()`, `.passthrough()`,
 * `z.looseObject()`, `.catchall(x)` unless `x` is `z.never()`) keeps every key the caller sent. When its
 * output reaches a Prisma write, those keys become relation writes (`workspace: { connect }`) and
 * foreign keys (`segmentId`) the caller should never set. ENG-7127's schema, the action and the write
 * sat in three files, so the rule flags the declaration itself. The `allow` option lists the files whose
 * open schemas never reach a write, each with its reason in `LOOSE_SCHEMA_ALLOWLIST` (base.mjs).
 */
const LOOSE_SCHEMA_METHODS = new Set(["loose", "passthrough"]);

const isOpenSchemaCall = (node) => {
  const name = calleeName(node);
  if (name === "looseObject") return true;
  if (!calleeObject(node)) return false;
  if (LOOSE_SCHEMA_METHODS.has(name)) return node.arguments.length === 0;
  if (name !== "catchall") return false;
  const rest = unwrapExpression(node.arguments[0]);
  return !(rest?.type === "CallExpression" && calleeName(rest) === "never");
};

const noLooseSchema = {
  meta: {
    type: "problem",
    docs: { description: "Disallow zod schemas that keep unknown keys." },
    schema: ALLOW_OPTION_SCHEMA,
  },
  create(context) {
    if (isAllowlisted(context)) return {};
    return {
      CallExpression(node) {
        if (!isOpenSchemaCall(node)) return;
        context.report({
          node,
          message:
            "This zod schema keeps every key the caller sends; in a Prisma write they become relation writes and foreign keys (ENG-7127). Use a strict schema, or add the file to LOOSE_SCHEMA_ALLOWLIST (packages/config-oxlint/base.mjs) with the reason its output never reaches a write.",
        });
      },
    };
  },
};

/*
 * `no-request-regexp` (ENG-7109's class): a pattern the caller sends, compiled into a regular
 * expression, can take the event loop for seconds (ReDoS); a length cap does not prevent it. Run such
 * patterns in a linear-time engine (apps/web/modules/api/lib/linear-pattern-matcher.ts) or not at all.
 * Sinks: `new RegExp(p)` / `RegExp(p)` whose result is used (a discarded one only checks the syntax),
 * and `.match(p)`, `.matchAll(p)`, `.search(p)`, which compile a string argument. `.split(p)` and
 * `.replace(p, …)` take a string as text, not as a pattern. Sources: the `parsedInput` and
 * `searchParams` of a function's first argument (server actions, v3 handlers, Next pages),
 * `.json()`/`.formData()`/`.text()` on a `req` or `request` (also `ctx.req`), and
 * `.searchParams.get()`. Patterns loaded from storage (a survey's validation rules, the shipped
 * ENG-7109 case) are not sources here: they stay a review check (CODING_STANDARDS.md, Security).
 */
const STRING_METHODS = new Set([
  "at",
  "concat",
  "get",
  "getAll",
  "join",
  "normalize",
  "padEnd",
  "padStart",
  "repeat",
  "replace",
  "replaceAll",
  "slice",
  "split",
  "substr",
  "substring",
  "toLocaleLowerCase",
  "toLocaleUpperCase",
  "toLowerCase",
  "toString",
  "toUpperCase",
  "trim",
  "trimEnd",
  "trimStart",
  "valueOf",
]);
const ELEMENT_CALLBACKS = new Set([
  "every",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "flatMap",
  "forEach",
  "map",
  "some",
]);
const IMPLICIT_REGEXP_METHODS = new Set(["match", "matchAll", "search"]);
const REQUEST_BODY_READERS = new Set(["formData", "json", "text"]);
const REQUEST_NAMES = new Set(["req", "request"]);
const REGEXP_SINK_TEXT = /RegExp|\.(?:match|matchAll|search)\s*\(/;

const isRequestRead = (node) => {
  const object = unwrapExpression(calleeObject(node));
  const name = calleeName(node);
  if (REQUEST_BODY_READERS.has(name)) {
    if (object?.type === "Identifier") return REQUEST_NAMES.has(object.name);
    return object?.type === "MemberExpression" && REQUEST_NAMES.has(keyOf(object));
  }
  if (name !== "get" && name !== "getAll") return false;
  if (object?.type === "Identifier") return object.name === "searchParams";
  return object?.type === "MemberExpression" && keyOf(object) === "searchParams";
};

// `value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`: a global character class holding every
// metacharacter, each match prefixed with a backslash, so the result matches only itself.
const REGEXP_METACHARACTERS = [...String.raw`\^$.*+?()[]{}|`];
const ESCAPE_CLASS = /[\dA-Za-z]/;
// The literal characters a character class body matches, or null when it holds a range (`a-z`) or an
// escape class (`\d`), whose members a lint rule should not guess.
const classMembers = (body) => {
  const members = new Set();
  for (let index = 0; index < body.length; index += 1) {
    let character = body[index];
    if (character === "\\") {
      index += 1;
      character = body[index];
      if (character === undefined || ESCAPE_CLASS.test(character)) return null;
    } else if (character === "-" && index > 0 && index < body.length - 1) {
      return null;
    }
    members.add(character);
  }
  return members;
};
const isRegExpEscape = (node) => {
  if (calleeName(node) !== "replace" && calleeName(node) !== "replaceAll") return false;
  const [pattern, replacement] = node.arguments.map(unwrapExpression);
  const source = pattern?.type === "Literal" ? (pattern.regex?.pattern ?? "") : "";
  return (
    /^\[[^^].*\]$/.test(source) &&
    REGEXP_METACHARACTERS.every((character) => classMembers(source.slice(1, -1))?.has(character)) &&
    pattern.regex.flags.includes("g") &&
    replacement?.type === "Literal" &&
    replacement.value === String.raw`\$&`
  );
};

const noRequestRegexp = {
  meta: {
    type: "problem",
    docs: { description: "Disallow compiling a regular expression from request input." },
    schema: [],
  },
  create(context) {
    return {
      Program(program) {
        if (!REGEXP_SINK_TEXT.test(context.sourceCode.text)) return;
        walkTaint(program, {
          deep: true,
          strings: true,
          paramLabels: () => [{ parsedInput: true, searchParams: true }],
          callLabel(node, labelOf) {
            const name = calleeName(node);
            const object = calleeObject(node);
            if (isRequestRead(node)) return true;
            if (isRegExpEscape(node)) return false;
            const firstArgument = node.arguments[0];
            if (!object) return name === "String" && labelOf(firstArgument) === true;
            const receiver = unwrapExpression(object);
            if (receiver.type === "Identifier" && receiver.name === "JSON") {
              return name === "parse" && labelOf(firstArgument) === true;
            }
            if (receiver.type === "Identifier" && receiver.name === "Object") {
              return ["entries", "values", "keys"].includes(name) && labelOf(firstArgument) === true;
            }
            // A schema's output carries the label of what it parsed, no more: parsing an object that
            // holds request input under some keys (a handler's first argument) taints those keys only.
            if (name === "parse" || name === "parseAsync") return labelOf(firstArgument);
            if (name === "safeParse" || name === "safeParseAsync") {
              const parsed = labelOf(firstArgument);
              return parsed && { data: parsed };
            }
            return STRING_METHODS.has(name) && labelOf(object) === true;
          },
          callbackLabels(node, labelOf, setParams) {
            if (node.type !== "CallExpression" || !ELEMENT_CALLBACKS.has(calleeName(node))) return;
            const object = calleeObject(node);
            if (object && labelOf(object) === true) setParams(node.arguments[0], [true]);
          },
          sink(node, labelOf) {
            const name = calleeName(node);
            if (name === "RegExp" && unwrapExpression(node.callee).type === "Identifier") {
              if (node.parent?.type === "ExpressionStatement") return;
            } else if (
              node.type !== "CallExpression" ||
              !IMPLICIT_REGEXP_METHODS.has(name) ||
              !calleeObject(node) ||
              // The String methods take one argument; query-key factories and search clients often more.
              node.arguments.length !== 1
            ) {
              return;
            }
            if (labelOf(node.arguments[0]) !== true) return;
            context.report({
              node,
              message:
                "This regular expression is compiled from request input, which can block the event loop (ReDoS); a length cap does not prevent it (ENG-7109). Match it in a linear-time engine (modules/api/lib/linear-pattern-matcher.ts), escape it, or don't run it.",
            });
          },
        });
      },
    };
  },
};

/*
 * `no-tsx-unit-test`: CODING_STANDARDS.md, Testing Guidelines: "Do not write component or UI unit tests
 * for `.tsx` files." Mechanically, a unit test is a `*.test.ts`: this fails a test file that needs JSX
 * (`*.test.tsx`, `*.spec.tsx`). A component test written in `.ts` is still a review finding. The `allow`
 * option lists the repo-relative paths of the tests that predate the check.
 */
const TSX_TEST = /\.(?:test|spec)\.[jt]sx$/;

const noTsxUnitTest = {
  meta: {
    type: "problem",
    docs: { description: "Disallow component and UI unit tests in .tsx/.jsx test files." },
    schema: ALLOW_OPTION_SCHEMA,
  },
  create(context) {
    if (!TSX_TEST.test(context.filename.replaceAll("\\", "/")) || isAllowlisted(context)) return {};
    return {
      Program(node) {
        context.report({
          node,
          message:
            "Component and UI unit tests in `.tsx` are not written here (CODING_STANDARDS.md, Testing Guidelines). Lift the logic into a `.ts` module and test it there; the feature journeys cover the rendering.",
        });
      },
    };
  },
};

export default {
  meta: { name: "formbricks" },
  rules: {
    "no-inline-lint-config": noInlineLintConfig,
    "no-loose-schema": noLooseSchema,
    "no-request-regexp": noRequestRegexp,
    "no-tsx-unit-test": noTsxUnitTest,
    "prefer-read-only-props": preferReadOnlyProps,
    "restricted-syntax": restrictedSyntax,
  },
};
