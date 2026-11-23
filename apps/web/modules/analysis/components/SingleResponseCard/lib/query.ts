/** Typed query-key factory for the response card's reads. Never inline string keys. */
const responseCardKeyBase = ["response-card"] as const;

export const responseCardKeys = {
  all: responseCardKeyBase,
  detail: (responseId: string) => [...responseCardKeyBase, "detail", responseId] as const,
};
