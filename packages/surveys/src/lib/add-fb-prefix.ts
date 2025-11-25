/**
 * Adds the 'fb-' prefix to Tailwind CSS classes for surveys
 * Handles pseudo-classes, responsive prefixes, and negative values
 */
export function addFbPrefix(className: string): string {
  if (!className) return className;

  return className
    .split(/\s+/)
    .map((cls) => {
      if (!cls || cls.startsWith("fb-")) return cls;

      // Handle pseudo-classes and responsive prefixes (hover:, focus:, sm:, etc.)
      const pseudoMatch = cls.match(/^([a-z-]+:)(.+)$/);
      if (pseudoMatch) {
        const [, prefix, rest] = pseudoMatch;
        // Add fb- prefix to the class part, handling negative values
        if (rest.startsWith("-")) {
          return `${prefix}-fb-${rest.slice(1)}`;
        }
        return `${prefix}fb-${rest}`;
      }

      // Handle negative values (e.g., -translate-x-1/2)
      if (cls.startsWith("-")) {
        return `-fb-${cls.slice(1)}`;
      }

      // Regular class
      return `fb-${cls}`;
    })
    .join(" ");
}
