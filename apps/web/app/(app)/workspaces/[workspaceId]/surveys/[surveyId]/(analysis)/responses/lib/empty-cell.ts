import { type ReactNode, isValidElement } from "react";

/** An answer with nothing in it: never given, blank, or an empty list or record. */
export const isEmptyResponseValue = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.every(isEmptyResponseValue);
  if (typeof value === "object") return Object.values(value).every(isEmptyResponseValue);
  return false;
};

/**
 * Whether a cell renders nothing a reader would see: no node at all, or an element whose only content
 * is empty — `<p>{undefined}</p>`, or a badge list with no items. Such a cell shows a dash instead,
 * as every other table does, so an empty value never reads as a rendering gap.
 */
export const isEmptyCellContent = (node: ReactNode): boolean => {
  if (node === null || node === undefined || typeof node === "boolean") return true;
  if (typeof node === "string") return node.trim().length === 0;
  if (Array.isArray(node)) return node.every(isEmptyCellContent);
  if (!isValidElement(node)) return false;
  const props = node.props as { children?: ReactNode; items?: unknown[]; id?: unknown };
  if (Array.isArray(props.items)) return props.items.length === 0;
  if ("id" in props) return props.id === undefined || props.id === null || props.id === "";
  if (!("children" in props)) return false;
  return isEmptyCellContent(props.children);
};
