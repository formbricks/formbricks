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

export default {
  meta: { name: "formbricks" },
  rules: {
    "no-inline-lint-config": noInlineLintConfig,
    "prefer-read-only-props": preferReadOnlyProps,
    "restricted-syntax": restrictedSyntax,
  },
};
