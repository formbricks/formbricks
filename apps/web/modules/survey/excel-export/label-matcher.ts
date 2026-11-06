/**
 * Finding a set of labels in a text in one linear pass (Aho–Corasick), for turning the `@Label`s an
 * edited cell shows back into the recalls they stand for (ENG-6809).
 *
 * A cell is the user's text, up to 32,767 characters, and the labels come from the survey, which the
 * user writes too: searching for each label from each position costs labels × text × label length, which
 * a crafted sheet turns into minutes of the server's thread. Here the cost is the text's length times the
 * number of labels at most, and `RECALL_LABELS_MAX` bounds that number.
 */

/** The most distinct labels one text's recalls are matched by; any past it stay as typed. */
export const RECALL_LABELS_MAX = 64;

interface TTrie {
  next: Map<number, number>[];
  /** The node a mismatch falls back to: the longest proper suffix of the node's path that is a path. */
  fail: number[];
  /** The length of the label the node's path is, or 0. */
  labelLength: number[];
  /** The nearest node on the fail chain whose path is a label, or -1. */
  output: number[];
}

/**
 * A string's key at `index`: its code point there, so a pair of surrogates is one key. Labels and texts
 * are keyed alike, position by position, so a label matches wherever its text does.
 */
const keyAt = (text: string, index: number): number => text.codePointAt(index) ?? 0;

const addNode = (trie: TTrie): number => {
  trie.next.push(new Map());
  trie.fail.push(0);
  trie.labelLength.push(0);
  trie.output.push(-1);
  return trie.next.length - 1;
};

const insertLabel = (trie: TTrie, label: string): void => {
  let node = 0;
  for (let index = 0; index < label.length; index += 1) {
    const key = keyAt(label, index);
    let child = trie.next[node].get(key);
    if (child === undefined) {
      child = addNode(trie);
      trie.next[node].set(key, child);
    }
    node = child;
  }
  trie.labelLength[node] = label.length;
};

/** Each node's fail target and nearest label on its fail chain, breadth first, parents before children. */
const linkFallbacks = (trie: TTrie): void => {
  const queue = [...trie.next[0].values()];
  // The queue grows as it is read: an array's iterator reads what was pushed after it started.
  for (const node of queue) {
    for (const [key, child] of trie.next[node]) {
      let fallback = trie.fail[node];
      while (fallback !== 0 && !trie.next[fallback].has(key)) fallback = trie.fail[fallback];
      const target = trie.next[fallback].get(key);
      trie.fail[child] = target === undefined || target === child ? 0 : target;
      const failNode = trie.fail[child];
      trie.output[child] = trie.labelLength[failNode] > 0 ? failNode : trie.output[failNode];
      queue.push(child);
    }
  }
};

const buildTrie = (labels: readonly string[]): TTrie => {
  const trie: TTrie = { next: [new Map()], fail: [0], labelLength: [0], output: [-1] };
  for (const label of labels) insertLabel(trie, label);
  linkFallbacks(trie);
  return trie;
};

/**
 * A matcher for `labels`: given a text, the length of the longest label starting at each of its
 * positions (0 where none does).
 */
export const createLabelMatcher = (labels: readonly string[]): ((text: string) => Int32Array) => {
  const trie = buildTrie(labels.filter((label) => label.length > 0));
  return (text) => {
    const longest = new Int32Array(text.length);
    let node = 0;
    for (let index = 0; index < text.length; index += 1) {
      const key = keyAt(text, index);
      while (node !== 0 && !trie.next[node].has(key)) node = trie.fail[node];
      node = trie.next[node].get(key) ?? 0;
      for (let found = trie.labelLength[node] > 0 ? node : trie.output[node]; found > 0; ) {
        const length = trie.labelLength[found];
        const start = index - length + 1;
        if (length > longest[start]) longest[start] = length;
        found = trie.output[found];
      }
    }
    return longest;
  };
};
