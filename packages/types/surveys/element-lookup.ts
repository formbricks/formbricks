type TNamedElement = { id: string; code?: string };

/**
 * Resolves the name a link carries (prefill key, `startAt`) to an element: the Question ID first, then
 * the question code (ADR 0016). The ID wins so a legacy survey whose ID equals another question's code
 * keeps resolving exactly as it did before codes existed.
 */
export const findElementByIdOrCode = <T extends TNamedElement>(
  elements: readonly T[],
  name: string
): T | undefined => {
  if (!name) return undefined;
  return elements.find((element) => element.id === name) ?? elements.find((element) => element.code === name);
};
