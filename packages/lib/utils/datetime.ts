import z from "zod";
// utility functions for date and time

// Helper function to calculate difference in days between two dates
export const diffInDays = (date1: Date, date2: Date) => {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

function isZodDate(schema: z.ZodTypeAny): boolean {
  // Check if the field is a ZodDate
  if (schema instanceof z.ZodDate) {
    return true;
  }

  // Check if the field is a nullable type and the inner type is ZodDate
  if (schema instanceof z.ZodNullable && schema._def.innerType instanceof z.ZodDate) {
    return true;
  }

  return false;
}

// Function to format date fields in an object based on a Zod schema
export function formatDateFields<T extends z.ZodRawShape>(object: unknown, zodSchema: z.ZodObject<T>): any {
  if (!object || typeof object !== "object") return null;
  const schemaFields = zodSchema.shape;
  const formattedObject = { ...object };

  for (const key in schemaFields) {
    if (Object.prototype.hasOwnProperty.call(schemaFields, key) && isZodDate(schemaFields[key])) {
      const dateStr = (formattedObject as any)[key];
      if (typeof dateStr === "string") {
        (formattedObject as any)[key] = new Date(dateStr);
      }
    }
  }

  return formattedObject as T;
}
