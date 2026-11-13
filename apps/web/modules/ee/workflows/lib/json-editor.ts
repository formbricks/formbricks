// Pure logic behind the workflow JsonEditor (ENG-7112): a JSON checker that says what is wrong and on
// which line, in words the editor can translate, and the Variable token handling that keeps a body
// valid JSON while it carries `#recall:<path>/fallback:<text>#` tokens (ADR 0045).

export type TJsonSyntaxErrorCode =
  | "missing_comma"
  | "missing_colon"
  | "trailing_comma"
  | "property_name"
  | "unterminated_string"
  | "invalid_escape"
  | "invalid_value"
  | "unexpected_end"
  | "extra_content"
  | "too_deep";

export interface TJsonSyntaxError {
  code: TJsonSyntaxErrorCode;
  /** 1-based line the mistake is on. */
  line: number;
  /** 1-based column on that line. */
  column: number;
  /** 0-based character offset into the text. */
  offset: number;
}

/**
 * Deeper nesting than this is reported instead of parsed, so a pasted `[[[[…` cannot exhaust the
 * call stack. Far above any request body or payload (the Webhook trigger accepts 10 levels).
 */
export const JSON_EDITOR_MAX_NESTING = 100;

class JsonCheckFailure extends Error {
  constructor(
    readonly code: TJsonSyntaxErrorCode,
    readonly offset: number
  ) {
    super(code);
  }
}

const isWhitespace = (char: string | undefined) =>
  char === " " || char === "\t" || char === "\n" || char === "\r";

const LITERALS = ["true", "false", "null"] as const;
const NUMBER_PATTERN = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const ESCAPE_PATTERN = /["\\/bfnrt]|u[0-9a-fA-F]{4}/y;

// A recursive-descent checker. `JSON.parse` would do, but its messages differ per browser, are
// English only and point at where parsing stopped, which for a missing comma is the next line.
class JsonChecker {
  private position = 0;
  // End of the last complete value or token, so "missing comma" can point at the line it belongs on.
  private lastValueEnd = 0;

  constructor(private readonly text: string) {}

  check(): void {
    this.skipWhitespace();
    this.parseValue(0);
    this.skipWhitespace();
    if (this.position < this.text.length) {
      throw new JsonCheckFailure("extra_content", this.position);
    }
  }

  private skipWhitespace() {
    while (isWhitespace(this.text[this.position])) this.position += 1;
  }

  private fail(code: TJsonSyntaxErrorCode, offset = this.position): never {
    throw new JsonCheckFailure(this.position >= this.text.length ? "unexpected_end" : code, offset);
  }

  private parseValue(depth: number) {
    const char = this.text[this.position];
    if (char === undefined) this.fail("unexpected_end");
    if (char === "{" || char === "[") {
      if (depth >= JSON_EDITOR_MAX_NESTING) throw new JsonCheckFailure("too_deep", this.position);
      if (char === "{") this.parseObject(depth + 1);
      else this.parseArray(depth + 1);
      return;
    }
    if (char === '"') {
      this.parseString();
      return;
    }
    if (char === "-" || (char >= "0" && char <= "9")) {
      this.parseNumber();
      return;
    }
    const literal = LITERALS.find((candidate) => this.text.startsWith(candidate, this.position));
    if (!literal) throw new JsonCheckFailure("invalid_value", this.position);
    this.position += literal.length;
    this.lastValueEnd = this.position;
  }

  private parseNumber() {
    NUMBER_PATTERN.lastIndex = this.position;
    const match = NUMBER_PATTERN.exec(this.text);
    if (!match) throw new JsonCheckFailure("invalid_value", this.position);
    this.position += match[0].length;
    this.lastValueEnd = this.position;
  }

  private parseString() {
    const start = this.position;
    this.position += 1;
    while (this.position < this.text.length) {
      const char = this.text[this.position];
      if (char === '"') {
        this.position += 1;
        this.lastValueEnd = this.position;
        return;
      }
      if (char === "\\") {
        ESCAPE_PATTERN.lastIndex = this.position + 1;
        const escape = ESCAPE_PATTERN.exec(this.text);
        if (!escape) throw new JsonCheckFailure("invalid_escape", this.position);
        this.position += 1 + escape[0].length;
        continue;
      }
      // A raw line break inside quotes is almost always a closing quote the author forgot.
      if (char === "\n" || char === "\r") throw new JsonCheckFailure("unterminated_string", start);
      if (char < " ") throw new JsonCheckFailure("invalid_value", this.position);
      this.position += 1;
    }
    throw new JsonCheckFailure("unterminated_string", start);
  }

  // Shared by objects and arrays: after an item, expect a comma or the closing bracket.
  private expectSeparator(closing: "}" | "]"): "comma" | "end" {
    this.skipWhitespace();
    const char = this.text[this.position];
    if (char === closing) {
      this.position += 1;
      this.lastValueEnd = this.position;
      return "end";
    }
    if (char === ",") {
      this.position += 1;
      this.skipWhitespace();
      if (this.text[this.position] === closing) {
        throw new JsonCheckFailure("trailing_comma", this.position - 1);
      }
      return "comma";
    }
    if (char === undefined) this.fail("unexpected_end");
    // The next item started without a comma: the comma belongs after the previous value.
    const startsItem = closing === "}" ? char === '"' : char !== "}" && char !== "]";
    if (startsItem) throw new JsonCheckFailure("missing_comma", this.lastValueEnd);
    throw new JsonCheckFailure("invalid_value", this.position);
  }

  private parseObject(depth: number) {
    this.position += 1;
    this.skipWhitespace();
    if (this.text[this.position] === "}") {
      this.position += 1;
      this.lastValueEnd = this.position;
      return;
    }
    for (;;) {
      this.skipWhitespace();
      if (this.text[this.position] !== '"') this.fail("property_name");
      this.parseString();
      this.skipWhitespace();
      if (this.text[this.position] !== ":") this.fail("missing_colon", this.lastValueEnd);
      this.position += 1;
      this.skipWhitespace();
      this.parseValue(depth);
      if (this.expectSeparator("}") === "end") return;
    }
  }

  private parseArray(depth: number) {
    this.position += 1;
    this.skipWhitespace();
    if (this.text[this.position] === "]") {
      this.position += 1;
      this.lastValueEnd = this.position;
      return;
    }
    for (;;) {
      this.skipWhitespace();
      this.parseValue(depth);
      if (this.expectSeparator("]") === "end") return;
    }
  }
}

const toLineAndColumn = (text: string, offset: number) => {
  let line = 1;
  let lineStart = 0;
  for (let index = 0; index < offset && index < text.length; index += 1) {
    if (text[index] === "\n") {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
};

export interface TJsonEditorVariable {
  /** Prefixed Variable path, e.g. `payload.customer.id` (ADR 0045). */
  path: string;
  fallback?: string;
}

export interface TJsonVariableToken {
  /** Start offset; for a whole value this is its opening quote. */
  from: number;
  /** End offset (exclusive); for a whole value this is past its closing quote. */
  to: number;
  path: string;
  /** The token is the entire string value, so the run inserts the Variable with its own type. */
  isWholeValue: boolean;
}

interface TJsonStringLiteral {
  /** Offset of the opening quote. */
  from: number;
  /** Offset past the closing quote, or of the line break that cut an unterminated string. */
  to: number;
  isClosed: boolean;
}

// The string literals of possibly invalid JSON, as an editor sees them while the author types:
// a line break ends an unterminated string, the way JSON forbids raw line breaks inside one.
const scanJsonStrings = (text: string): TJsonStringLiteral[] => {
  const literals: TJsonStringLiteral[] = [];
  let index = 0;
  while (index < text.length) {
    if (text[index] !== '"') {
      index += 1;
      continue;
    }
    const from = index;
    index += 1;
    let isClosed = false;
    while (index < text.length) {
      const char = text[index];
      if (char === "\\") {
        index += 2;
        continue;
      }
      if (char === "\n" || char === "\r") break;
      index += 1;
      if (char === '"') {
        isClosed = true;
        break;
      }
    }
    literals.push({ from, to: Math.min(index, text.length), isClosed });
  }
  return literals;
};

const isInsideJsonString = (text: string, offset: number) =>
  scanJsonStrings(text).some((literal) =>
    literal.isClosed
      ? literal.from < offset && offset < literal.to
      : literal.from < offset && offset <= literal.to
  );

const RECALL_TOKEN_IN_JSON_PATTERN = /#recall:([^\s/#"\\]+)\/fallback:(?:[^#"\\]|\\.)*#/g;

const buildRecallToken = ({ path, fallback }: TJsonEditorVariable) =>
  `#recall:${path}/fallback:${(fallback ?? "").replaceAll("#", "")}#`;

/**
 * Replaces `from`–`to` (the typed `@`) with a Variable token that keeps the body valid JSON: as a
 * quoted string where a value goes, so the run can insert the Variable with its type, or as
 * escaped text inside an existing string.
 */
export const insertJsonVariableToken = (
  text: string,
  from: number,
  to: number,
  variable: TJsonEditorVariable
): { text: string; cursor: number } => {
  const quoted = JSON.stringify(buildRecallToken(variable));
  const insert = isInsideJsonString(text, from) ? quoted.slice(1, -1) : quoted;
  return { text: text.slice(0, from) + insert + text.slice(to), cursor: from + insert.length };
};

/**
 * The Variable tokens in string values, which the editor shows as chips. Tokens in property names
 * or outside strings are left as text: the run does not read them as Variables.
 */
export const findJsonVariableTokens = (text: string): TJsonVariableToken[] => {
  const tokens: TJsonVariableToken[] = [];
  for (const literal of scanJsonStrings(text)) {
    if (!literal.isClosed) continue;
    const rest = text.slice(literal.to);
    if (/^\s*:/.test(rest)) continue;
    const content = text.slice(literal.from + 1, literal.to - 1);
    for (const match of content.matchAll(RECALL_TOKEN_IN_JSON_PATTERN)) {
      const isWholeValue = match[0].length === content.length;
      const start = literal.from + 1 + (match.index ?? 0);
      tokens.push({
        from: isWholeValue ? literal.from : start,
        to: isWholeValue ? literal.to : start + match[0].length,
        path: match[1],
        isWholeValue,
      });
    }
  }
  return tokens;
};

/**
 * The first JSON mistake in `text`, or null when it parses. A missing comma or colon is reported on
 * the line of the value it should follow. Blank text is valid when `allowEmpty` is set, for fields
 * where no body at all is a valid choice.
 */
export const findJsonSyntaxError = (
  text: string,
  options: { allowEmpty?: boolean } = {}
): TJsonSyntaxError | null => {
  if (options.allowEmpty && text.trim() === "") return null;
  try {
    new JsonChecker(text).check();
    return null;
  } catch (error) {
    if (!(error instanceof JsonCheckFailure)) throw error;
    // An error at the very end belongs to the last line that has content, not a trailing blank one.
    const offset = error.code === "unexpected_end" ? text.trimEnd().length : error.offset;
    return { code: error.code, offset, ...toLineAndColumn(text, offset) };
  }
};
