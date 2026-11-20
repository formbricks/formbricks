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
 * Same-function taint tracking, for the two security rules below (ENG-7450). A JS plugin sees one file
 * at a time, so a value is followed only inside the file: through variables, destructuring, object
 * spreads and the closures of the function that produced it, never into a function it is passed to.
 * That keeps the rules precise, at the cost of recall: a source in one file and a sink in another (as
 * in ENG-7127, where the schema, the action and the Prisma write sat in three files) is not reported.
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
const BLOCK_SCOPES = new Set(["BlockStatement", "ForStatement", "StaticBlock", "SwitchStatement"]);
// Type positions hold no values; skipping them keeps the walk cheap.
const TYPE_KEYS = new Set(["parent", "returnType", "typeAnnotation", "typeArguments", "typeParameters"]);

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

const union = (a, b) => {
  if (a === true || b === true) return true;
  if (!a) return b;
  if (!b) return a;
  return { ...a, ...b };
};

const memberLabel = (label, key, deep) => {
  if (label === true) return deep;
  if (label && key !== undefined && Object.hasOwn(label, key)) return label[key];
  return false;
};

/*
 * Walks `program` once and calls `policy.sink(node, labelOf)` on every call and `new` expression.
 * `policy` decides what is a source:
 * - `deep`: a property of a tainted value is tainted (a request field), or not (the keys of a loose
 *   object are what is tainted, not its declared fields).
 * - `strings`: a template, a concatenation or a string method carries the taint of its operands.
 * - `callLabel(node, labelOf, shadowed)`: the label of a call's result, for sources (`req.json()`) and
 *   pass-throughs (`schema.parse(tainted)`).
 * - `paramLabels(fn)`: the labels of a function's parameters, unless a call site set them.
 * - `callbackLabels(node, labelOf, setParams, shadowed)`: for a call or object expression, the labels of the
 *   parameters of a function among its arguments (a `.map` callback, an action's handler).
 */
function walkTaint(program, policy) {
  const scopes = [new Map()];
  const presetParams = new Map();
  const setParams = (fn, labels) => {
    if (fn && (fn.type === "ArrowFunctionExpression" || fn.type === "FunctionExpression")) {
      presetParams.set(fn, labels);
    }
  };

  const lookup = (name) => {
    for (let index = scopes.length - 1; index >= 0; index -= 1) {
      if (scopes[index].has(name)) return scopes[index].get(name);
    }
    return false;
  };
  // Whether `name` is declared below the module scope, so it no longer names a top-level binding.
  const shadowed = (name) => scopes.slice(1).some((scope) => scope.has(name));
  const assign = (name, label) => {
    for (let index = scopes.length - 1; index >= 0; index -= 1) {
      if (scopes[index].has(name)) {
        scopes[index].set(name, label);
        return;
      }
    }
  };

  const labelOf = (expression) => {
    const node = unwrapExpression(expression);
    switch (node?.type) {
      case "Identifier":
        return lookup(node.name);
      case "MemberExpression":
        return memberLabel(labelOf(node.object), keyOf(node), policy.deep);
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
        return policy.callLabel(node, labelOf, shadowed) || false;
      default:
        return false;
    }
  };

  // Declares the names in `pattern` in the current scope, or, with `set = assign`, updates them where
  // they are declared (a destructuring assignment).
  const declare = (name, label) => scopes.at(-1).set(name, label);
  const bind = (pattern, label, set = declare) => {
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

  const visitChildren = (node) => {
    for (const key of Object.keys(node)) {
      if (TYPE_KEYS.has(key)) continue;
      const child = node[key];
      if (Array.isArray(child)) for (const item of child) visit(item);
      else if (child && typeof child.type === "string") visit(child);
    }
  };

  const visitFunction = (fn) => {
    const labels = presetParams.get(fn) ?? policy.paramLabels?.(fn) ?? [];
    scopes.push(new Map());
    fn.params.forEach((param, index) => {
      if (param.type === "AssignmentPattern") visit(param.right);
      bind(param, labels[index] ?? false);
    });
    visit(fn.body);
    scopes.pop();
  };

  const visitLoop = (node) => {
    visit(node.right);
    scopes.push(new Map());
    const label = labelOf(node.right);
    // `for (const x of tainted)` yields its elements; `for (const k in tainted)` its keys.
    const element = label === true ? policy.deep : false;
    const target = node.left.type === "VariableDeclaration" ? node.left.declarations[0].id : null;
    if (target) bind(target, element);
    else if (node.left.type === "Identifier") assign(node.left.name, element);
    visit(node.body);
    scopes.pop();
  };

  function visit(node) {
    if (!node || typeof node.type !== "string") return;
    switch (node.type) {
      case "ArrowFunctionExpression":
      case "FunctionExpression":
      case "FunctionDeclaration":
        visitFunction(node);
        return;
      case "VariableDeclarator":
        visit(node.init);
        bind(node.id, labelOf(node.init));
        return;
      case "AssignmentExpression":
        visit(node.right);
        if (node.left.type === "Identifier") {
          const right = labelOf(node.right);
          assign(node.left.name, node.operator === "=" ? right : union(lookup(node.left.name), right));
        } else if (node.left.type === "ObjectPattern" || node.left.type === "ArrayPattern") {
          bind(node.left, labelOf(node.right), assign);
        } else {
          visit(node.left);
        }
        return;
      case "CatchClause":
        scopes.push(new Map());
        bind(node.param, false);
        visit(node.body);
        scopes.pop();
        return;
      case "ForOfStatement":
      case "ForInStatement":
        visitLoop(node);
        return;
      case "CallExpression":
      case "NewExpression":
      case "ObjectExpression":
        policy.callbackLabels?.(node, labelOf, setParams, shadowed);
        visitChildren(node);
        if (node.type !== "ObjectExpression") policy.sink(node, labelOf);
        return;
      default:
    }
    const scoped = BLOCK_SCOPES.has(node.type);
    if (scoped) scopes.push(new Map());
    visitChildren(node);
    if (scoped) scopes.pop();
  }

  visit(program);
}

const calleeName = (node) => {
  const callee = unwrapExpression(node.callee);
  if (callee?.type === "Identifier") return callee.name;
  return callee?.type === "MemberExpression" ? keyOf(callee) : undefined;
};

const propertyNamed = (object, key) =>
  object.properties.find((candidate) => candidate.type === "Property" && keyOf(candidate) === key);

const calleeObject = (node) => {
  const callee = unwrapExpression(node.callee);
  return callee?.type === "MemberExpression" ? callee.object : undefined;
};

/*
 * `no-loose-schema-prisma-write` (ENG-7127): the output of a loose zod schema (`z.looseObject`,
 * `.loose()`, `.passthrough()`, `.catchall()`) keeps every key the caller sent. Spread or passed whole
 * into a Prisma write's `data`, those keys become relation writes (`workspace: { connect }`) and
 * foreign keys (`segmentId`) the caller should never set. Pick the columns, or parse with a strict
 * schema. Reported inside one file: a loose schema declared at the top level of the file or inline,
 * whose output (`.parse()`, `.safeParse().data`, the `parsedInput` of an action or a v3 handler using
 * it as its input schema) reaches `data`, `create` or `update` of a `<client>.<model>.create|update|…`
 * call, directly or through variables, rest destructuring and object spreads.
 */
const LOOSE_METHODS = new Set(["loose", "passthrough"]);
// Methods whose result keeps the unknown keys of the schema they are called on.
const SCHEMA_KEEPERS = new Set([
  "brand",
  "catch",
  "check",
  "default",
  "describe",
  "extend",
  "meta",
  "nullable",
  "nullish",
  "omit",
  "optional",
  "partial",
  "pick",
  "readonly",
  "refine",
  "required",
  "safeExtend",
  "superRefine",
]);
const PRISMA_WRITES = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
]);
const WRITE_KEYS = new Set(["data", "create", "update"]);
const LOOSE_SOURCE_TEXT = /\b(?:looseObject|loose|passthrough|catchall)\s*\(/;

const noLooseSchemaPrismaWrite = {
  meta: {
    type: "problem",
    docs: { description: "Disallow the output of a loose zod schema in a Prisma write's data." },
    schema: [],
  },
  create(context) {
    return {
      Program(program) {
        if (!LOOSE_SOURCE_TEXT.test(context.sourceCode.text)) return;

        const looseNames = new Set();
        // `shadowed(name)`: whether the scope being walked redeclares a top-level name.
        const isLoose = (expression, shadowed = () => false) => {
          const node = unwrapExpression(expression);
          if (node?.type === "Identifier") return looseNames.has(node.name) && !shadowed(node.name);
          if (node?.type !== "CallExpression") return false;
          const name = calleeName(node);
          const object = calleeObject(node);
          if (!object) return false;
          if (name === "looseObject") return true;
          if (LOOSE_METHODS.has(name)) return true;
          // `.catchall(z.never())` rejects unknown keys, like `.strict()`.
          if (name === "catchall") return calleeName(node.arguments[0] ?? {}) !== "never";
          return SCHEMA_KEEPERS.has(name) && isLoose(object, shadowed);
        };

        // Top-level schemas, in any order: `const B = A.extend({…})` may follow or precede `A`.
        const declarators = program.body
          .map((statement) =>
            statement.type === "ExportNamedDeclaration" ? statement.declaration : statement
          )
          .filter((statement) => statement?.type === "VariableDeclaration")
          .flatMap((statement) => statement.declarations)
          .filter((declarator) => declarator.id.type === "Identifier" && declarator.init);
        let grew = true;
        while (grew) {
          grew = false;
          for (const declarator of declarators) {
            if (!looseNames.has(declarator.id.name) && isLoose(declarator.init)) {
              looseNames.add(declarator.id.name);
              grew = true;
            }
          }
        }

        // The `.inputSchema(S)` (or older `.schema(S)`) of an action client chain ending in `.action(fn)`.
        const actionSchemaOf = (call) => {
          for (let node = calleeObject(call); node?.type === "CallExpression"; node = calleeObject(node)) {
            const name = calleeName(node);
            if (name === "inputSchema" || name === "schema") return node.arguments[0];
          }
          return undefined;
        };

        walkTaint(program, {
          deep: false,
          strings: false,
          callLabel(node, _labelOf, shadowed) {
            const name = calleeName(node);
            const object = calleeObject(node);
            if (!object || !isLoose(object, shadowed)) return false;
            if (name === "parse" || name === "parseAsync") return true;
            if (name === "safeParse" || name === "safeParseAsync") return { data: true };
            return false;
          },
          callbackLabels(node, _labelOf, setParams, shadowed) {
            if (node.type === "CallExpression" && calleeName(node) === "action") {
              const schema = actionSchemaOf(node);
              if (schema && isLoose(schema, shadowed)) setParams(node.arguments[0], [{ parsedInput: true }]);
              return;
            }
            if (node.type !== "ObjectExpression") return;
            // `withV3ApiWrapper({ schemas: { body: S }, handler: ({ parsedInput }) => … })`.
            const handler = propertyNamed(node, "handler")?.value;
            const schemas = unwrapExpression(propertyNamed(node, "schemas")?.value);
            if (!handler || schemas?.type !== "ObjectExpression") return;
            const parsedInput = {};
            for (const entry of schemas.properties) {
              if (entry.type === "Property" && isLoose(entry.value, shadowed))
                parsedInput[keyOf(entry)] = true;
            }
            if (Object.keys(parsedInput).length > 0) setParams(handler, [{ parsedInput }]);
          },
          sink(node, labelOf) {
            if (node.type !== "CallExpression" || !PRISMA_WRITES.has(calleeName(node))) return;
            // `<client>.<model>.<write>(…)`: `prisma.survey.update`, `tx.survey.update`.
            if (unwrapExpression(calleeObject(node))?.type !== "MemberExpression") return;
            const args = unwrapExpression(node.arguments[0]);
            if (args?.type !== "ObjectExpression") return;
            for (const property of args.properties) {
              if (property.type !== "Property" || !WRITE_KEYS.has(keyOf(property))) continue;
              if (labelOf(property.value) !== true) continue;
              context.report({
                node: property.value,
                message:
                  "This Prisma write takes the output of a loose zod schema, which keeps every key the caller sent: unknown keys become relation writes and foreign keys (ENG-7127). Write the columns by name, or parse with a strict schema.",
              });
            }
          },
        });
      },
    };
  },
};

/*
 * `no-request-regexp` (ENG-7109): a pattern the caller sends, compiled with `new RegExp`, can take the
 * event loop for seconds (ReDoS); a length cap does not prevent it. Run such patterns in a linear-time
 * engine (apps/web/modules/api/lib/linear-pattern-matcher.ts) or not at all. Reported inside one
 * function and its closures: the request sources are the `parsedInput` of a server action or v3
 * handler, `req.json()`/`.formData()`/`.text()` on a parameter named `req` or `request`, and
 * `.searchParams.get()`. A `new RegExp(x)` whose result is discarded only checks the syntax, which
 * runs nothing, and is not reported. Patterns loaded from storage (a survey's validation rules, the
 * shipped ENG-7109 case) are not sources here: they stay a review check (CODING_STANDARDS.md, Security).
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
const REQUEST_BODY_READERS = new Set(["formData", "json", "text"]);
const REQUEST_NAMES = new Set(["req", "request"]);

const isRequestRead = (node) => {
  const object = unwrapExpression(calleeObject(node));
  const name = calleeName(node);
  if (REQUEST_BODY_READERS.has(name)) return object?.type === "Identifier" && REQUEST_NAMES.has(object.name);
  if (name !== "get" && name !== "getAll") return false;
  if (object?.type === "Identifier") return object.name === "searchParams";
  return object?.type === "MemberExpression" && keyOf(object) === "searchParams";
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
        if (!context.sourceCode.text.includes("RegExp")) return;
        walkTaint(program, {
          deep: true,
          strings: true,
          paramLabels: () => [{ parsedInput: true }],
          callLabel(node, labelOf) {
            const name = calleeName(node);
            const object = calleeObject(node);
            if (isRequestRead(node)) return true;
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
            if (calleeName(node) !== "RegExp" || unwrapExpression(node.callee).type !== "Identifier") return;
            if (node.parent?.type === "ExpressionStatement") return;
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
 * for `.tsx` files." A test file that needs JSX (`*.test.tsx`, `*.spec.tsx`) is one. Lift the logic into
 * a `.ts` module and test it there. The `allow` option lists the repo-relative paths of the tests that
 * predate the check.
 */
const TSX_TEST = /\.(?:test|spec)\.[jt]sx$/;

const noTsxUnitTest = {
  meta: {
    type: "problem",
    docs: { description: "Disallow component and UI unit tests in .tsx/.jsx test files." },
    schema: [
      {
        type: "object",
        properties: { allow: { type: "array", items: { type: "string" }, uniqueItems: true } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");
    if (!TSX_TEST.test(filename)) return {};
    const allow = context.options[0]?.allow ?? [];
    if (allow.some((entry) => filename.endsWith(`/${entry}`))) return {};
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
    "no-loose-schema-prisma-write": noLooseSchemaPrismaWrite,
    "no-request-regexp": noRequestRegexp,
    "no-tsx-unit-test": noTsxUnitTest,
    "prefer-read-only-props": preferReadOnlyProps,
    "restricted-syntax": restrictedSyntax,
  },
};
