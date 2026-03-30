import { UpdateQueue } from "@/lib/user/update-queue";
import { type NetworkError, type Result, okVoid } from "@/types/error";

/**
 * Sets attributes on the current user/contact.
 *
 * Attribute types are determined by the JavaScript value type:
 * - String values → string attribute
 * - Number values → number attribute
 * - Date objects → date attribute (converted to ISO string)
 * - ISO 8601 date strings → date attribute
 *
 * On first write to a new attribute, the type is set based on the JS value type.
 * On subsequent writes, the value must match the existing attribute type.
 *
 * @param attributes - Key-value pairs where values can be strings, numbers, or Date objects
 */
export const setAttributes = async (
  attributes: Record<string, string | number | Date>
  // eslint-disable-next-line @typescript-eslint/require-await -- we want to use promises here
): Promise<Result<void, NetworkError>> => {
  // Normalize values: convert Date to ISO string, preserve numbers as numbers
  const normalizedAttributes: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value instanceof Date) {
      // Date objects become ISO strings (backend will detect as date type)
      normalizedAttributes[key] = value.toISOString();
    } else {
      // Preserve strings as strings, numbers as numbers
      normalizedAttributes[key] = value;
    }
  }

  const updateQueue = UpdateQueue.getInstance();
  updateQueue.updateAttributes(normalizedAttributes);
  void updateQueue.processUpdates();
  return okVoid();
};
