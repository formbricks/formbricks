import { isResponseTopicDimensionId } from "./schema-definition";

/**
 * Which conditions on a response's topics can hold together in one query (ENG-6989).
 *
 * Response Topic and Response Subtopic read one fan-out join: a record meets each topic of its response as
 * a row of its own, and Cube checks a query's conditions against one such row at a time. One condition
 * means what it says: "Response topic equals Billing, Login" keeps the rows whose topic is either, so the
 * records of every response that mentions either. Two conditions with values, ANDed, must hold for the
 * same row. "Equals Payments" and "equals Login" ask one row to be both, and match nothing, where a reader
 * expects the responses that mention both. A topic and a subtopic condition read the same rows, so they
 * clash the same way, and so does a condition under an `or` ANDed with another.
 *
 * Two conditions on one field still mean what they say when the topics of one are all among the topics of
 * every other: the rows of that shortest list pass all of them, and a response mentions one of those
 * exactly when it mentions one of each list. A dashboard pick of Payments on a chart saved for Payments is
 * such a case. `set` and `notSet` never clash: a row passes or fails them together with any value.
 *
 * The validator refuses a query whose conditions clash, and a dashboard pick that would make a chart's
 * conditions clash leaves the chart unfilterable (`resolvePicksForDataset`), so a chart never shows
 * nothing silently because of it.
 */

type TTopicCondition = { field: string; values: readonly string[] };

type TTopicConditions = {
  /** The `equals` conditions with values on a response-topic field that must hold at once. */
  conditions: TTopicCondition[];
  /**
   * The conditions with values that cannot be compared with others, each counted once: an `or` group
   * holding one, or a condition with another operator. Each clashes with any other condition.
   */
  opaque: number;
  /** Whether conditions somewhere in the tree clash already. */
  clashes: boolean;
};

const NONE: TTopicConditions = { conditions: [], opaque: 0, clashes: false };

/**
 * Whether ANDed conditions mean what they say: there is at most one, or all are on one field and the list
 * of one is within every other's.
 */
const holdTogether = ({ conditions, opaque }: Omit<TTopicConditions, "clashes">): boolean => {
  if (conditions.length + opaque <= 1) return true;
  if (opaque > 0) return false;
  const [first] = conditions;
  if (conditions.some(({ field }) => field !== first.field)) return false;
  // A list within every other is no longer than any of them.
  const shortest = conditions.reduce((min, condition) =>
    condition.values.length < min.values.length ? condition : min
  );
  return conditions.every(({ values }) => shortest.values.every((value) => values.includes(value)));
};

const readRules = (rules: readonly unknown[]): TTopicConditions => {
  const parts = rules.map(readRule);
  const merged = {
    conditions: parts.flatMap((part) => part.conditions),
    opaque: parts.reduce((total, part) => total + part.opaque, 0),
  };
  return { ...merged, clashes: parts.some((part) => part.clashes) || !holdTogether(merged) };
};

/** One filter rule, read defensively: a stored query is JSON. */
const readRule = (rule: unknown): TTopicConditions => {
  if (typeof rule !== "object" || rule === null) return NONE;
  const { member, operator, values, and, or } = rule as Record<string, unknown>;
  if (Array.isArray(and)) return readRules(and);
  if (Array.isArray(or)) {
    const branches = or.map(readRule);
    const holdsOne = branches.some((branch) => branch.conditions.length > 0 || branch.opaque > 0);
    return { conditions: [], opaque: holdsOne ? 1 : 0, clashes: branches.some((branch) => branch.clashes) };
  }
  if (typeof member !== "string" || !isResponseTopicDimensionId(member)) return NONE;
  if (!Array.isArray(values) || values.length === 0) return NONE;
  if (operator !== "equals") return { conditions: [], opaque: 1, clashes: false };
  return { conditions: [{ field: member, values: values.map(String) }], opaque: 0, clashes: false };
};

/** Whether `filters`, ANDed as a query's are, hold response-topic conditions that clash. */
export const responseTopicConditionsClash = (filters: readonly unknown[] | undefined): boolean =>
  readRules(filters ?? []).clashes;

/** Whether ANDing `rule` onto `filters` makes their response-topic conditions clash where they did not. */
export const ruleAddsResponseTopicClash = (filters: readonly unknown[], rule: unknown): boolean =>
  !responseTopicConditionsClash(filters) && responseTopicConditionsClash([...filters, rule]);

/** Why a query whose response-topic conditions clash is refused. */
export const RESPONSE_TOPIC_CLASH_REASON =
  "Conditions on Response topic and Response subtopic hold for one topic of the response at a time, so two of them with different topics match nothing. To keep the responses that mention any of several topics, list them in one equals condition. Keeping only the responses that mention all of several topics is not supported.";
