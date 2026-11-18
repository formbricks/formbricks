import { findDescendants, findProperty, keyName, unwrapExpression } from "./ast.mjs";

const LOG_LEVELS = new Set(["trace", "debug", "info", "warn", "error", "fatal"]);
// `logger`, `scopedLogger`, `requestLogger`: the pino instance or a child of it.
const LOGGER_NAME = /logger$/i;
// What code names a caught error (`error`, `err`, `e`, `parseError`). Booleans and predicates
// (`hasError`, `isError`) are not errors.
const ERROR_NAME = /^(e|err|error|\w+Error)$/;
const PREDICATE_NAME = /^(has|is|should|can|did|was)[A-Z]/;

/** `logger`, `this.logger`, `ctx.requestLogger`, or a child of one: `logger.child({…})`. */
const isLoggerObject = (node) => {
  if (node.type === "Identifier") return LOGGER_NAME.test(node.name);
  if (node.type === "MemberExpression" && !node.computed)
    return LOGGER_NAME.test(keyName(node.property) ?? "");
  if (node.type === "CallExpression" && node.callee.type === "MemberExpression") {
    return keyName(node.callee.property) === "child" && isLoggerObject(node.callee.object);
  }
  return false;
};

const isLoggerCall = (node) =>
  node.callee.type === "MemberExpression" &&
  !node.callee.computed &&
  isLoggerObject(node.callee.object) &&
  LOG_LEVELS.has(keyName(node.callee.property));

/** A bare identifier the code calls an error: `error`, `err`, `e`, `parseError`. */
const isErrorIdentifier = (node) =>
  node?.type === "Identifier" && ERROR_NAME.test(node.name) && !PREDICATE_NAME.test(node.name);

const isErrorName = (name) => typeof name === "string" && ERROR_NAME.test(name) && !PREDICATE_NAME.test(name);

/** An error itself: `error`, or a property that holds one (`result.error`, `state.lastErr`). */
const isErrorValue = (node) =>
  isErrorIdentifier(node) ||
  (node?.type === "MemberExpression" && !node.computed && isErrorName(keyName(node.property)));

/** An error or anything reached through one: `err`, `err.cause`, `result.error.details`. */
const isWithinError = (node) =>
  isErrorValue(node) || (node?.type === "MemberExpression" && !node.computed && isWithinError(node.object));

/** `<error>.message`, however it is embedded (template, object, concatenation). */
const isErrorMessage = (node) =>
  node.type === "MemberExpression" &&
  !node.computed &&
  keyName(node.property) === "message" &&
  isWithinError(node.object);

export const loggableErrorRule = {
  meta: {
    type: "problem",
    docs: { description: "Log caught errors through loggableError, never their message." },
    schema: [],
    messages: {
      rawError:
        "Log the error through `loggableError(error)` (name and stack frames only). pino's `err` serializer writes the message, which can carry prompts, file text, OAuth codes or respondent answers.",
      errorMessage:
        "An error's message can carry prompts, file text, OAuth codes or respondent answers. Log `loggableError(error)` instead of its message.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isLoggerCall(node)) return;
        const first = unwrapExpression(node.arguments[0]);
        if (isErrorValue(first)) {
          context.report({ node: first, messageId: "rawError" });
        }
        if (first?.type === "ObjectExpression") {
          for (const key of ["err", "error"]) {
            const property = findProperty(first, key);
            if (!property) continue;
            const value = unwrapExpression(property.value);
            if (isErrorValue(value)) {
              context.report({ node: property, messageId: "rawError" });
            }
          }
        }
        for (const message of node.arguments.flatMap((argument) =>
          findDescendants(argument, isErrorMessage)
        )) {
          context.report({ node: message, messageId: "errorMessage" });
        }
      },
    };
  },
};
