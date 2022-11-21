import { generateId } from "./utils";

export const getElementId = (id: string | undefined, name?: string) =>
  typeof id !== "undefined" ? id : name ? name : generateId(3);
