/**
 * Errors as code that handles user content logs them: name and stack frames, never the message. A
 * message can carry that content — the AI SDK's errors repeat the prompt or the model's output, a parser's
 * error quotes the line it choked on — so it is not safe to log however the error arose. Frames are file
 * paths, so a bug still points at its line.
 *
 * Use these instead of `{ err: error }` wherever the error may carry user content: pino's `err` serializer
 * writes the message, the stack header (which repeats the message), every cause's message and every
 * enumerable field.
 */

/** What `loggableError` puts in a log line: an error's name and frames, or the type of a non-Error throw. */
export type TLoggableError = { errName: string; errStack?: string } | { errType: string };

/**
 * The stack frames of an error, without the header V8 puts above them, or none when that header cannot
 * be told apart from them.
 *
 * The header is `${name}: ${message}` as it stood when `stack` was first read, and spans as many lines
 * as the message did — a message line indented like a frame would pass a frame filter. It is matched
 * whole rather than counted: a message changed after the stack was read would otherwise shift the cut,
 * letting old message lines through or dropping real frames. Anything unexpected — a rewritten stack, a
 * non-string message — logs no frames.
 *
 * One case is out of reach: a message cut back at a line break after the stack was read still matches,
 * and the lines it lost pass as frames. A string stack does not say where its header ended, so nothing
 * here can tell; no code that logs through this rewrites a message that way.
 */
export const stackFrames = (error: Error): string[] => {
  const { name, message, stack } = error;
  if (typeof stack !== "string" || typeof name !== "string" || typeof message !== "string") {
    return [];
  }

  // Error.prototype.toString's rule, which is what V8 writes as the header. Node's own errors put their
  // code after the name (`TypeError [ERR_INVALID_STATE]: …`), and those are the ones worth locating.
  const withName = (label: string) => {
    if (!label) return message;
    return message ? `${label}: ${message}` : label;
  };
  const { code } = error as { code?: unknown };
  const headers = [withName(name), ...(typeof code === "string" ? [withName(`${name} [${code}]`)] : [])];
  const header = headers.find((candidate) => stack.startsWith(`${candidate}\n`));
  if (header === undefined) {
    return [];
  }

  return stack
    .slice(header.length + 1)
    .split("\n")
    .filter((line) => /^\s+at /.test(line));
};

/** `{ errName, errStack }` for an `Error`, `{ errType }` for anything else thrown. */
export const loggableError = (error: unknown): TLoggableError => {
  if (!(error instanceof Error)) {
    return { errType: typeof error };
  }

  const frames = stackFrames(error);
  return {
    errName: typeof error.name === "string" ? error.name : typeof error.name,
    ...(frames.length > 0 ? { errStack: frames.join("\n") } : {}),
  };
};
