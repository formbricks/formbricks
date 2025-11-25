import { addFbPrefix } from "./add-fb-prefix";

/**
 * Enhanced cn utility that automatically adds fb- prefix to classes
 * This replaces survey-core's cn utility via Vite alias
 * All survey-core components will automatically get fb- prefixed classes
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  // Filter out falsy values and join
  const combined = classes.filter((cls): cls is string => Boolean(cls)).join(" ");
  // Add fb- prefix to all Tailwind classes
  // Handle empty string case (when all classes are falsy)
  if (!combined) return "";
  return addFbPrefix(combined);
}
