import { UpdateQueue } from "@/lib/user/update-queue";
import { type NetworkError, type Result, okVoid } from "@/types/error";

/**
 * Sets attributes on the current user/contact.
 *
 * Attribute types are inferred from the value:
 * - Date objects or ISO 8601 strings → date type
 * - Numbers or numeric strings → number type
 * - All other strings → string type
 *
 * On first write to a new attribute, the type is auto-detected.
 * On subsequent writes, the value must match the existing type.
 *
 * @param attributes - Key-value pairs where values can be strings, numbers, or Date objects
 */
export const setAttributes = async (
  attributes: Record<string, string | number | Date>
  // eslint-disable-next-line @typescript-eslint/require-await -- we want to use promises here
): Promise<Result<void, NetworkError>> => {
  // Normalize values: convert Date to ISO string, numbers to string
  const normalizedAttributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value instanceof Date) {
      normalizedAttributes[key] = value.toISOString();
    } else if (typeof value === "number") {
      normalizedAttributes[key] = String(value);
    } else {
      normalizedAttributes[key] = value;
    }
  }

  const updateQueue = UpdateQueue.getInstance();
  updateQueue.updateAttributes(normalizedAttributes);
  void updateQueue.processUpdates();
  return okVoid();
};
