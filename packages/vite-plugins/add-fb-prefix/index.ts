import type { Plugin } from "vite";

/**
 * Vite plugin that automatically adds 'fb-' prefix to Tailwind classes
 * in className strings from @formbricks/survey-core components
 */
export function addFbPrefixPlugin(): Plugin {
  return {
    name: "add-fb-prefix",
    enforce: "pre",
    transform(code, id) {
      // Only process files that import from survey-core
      if (!id.includes("node_modules") && code.includes("@formbricks/survey-core")) {
        // Transform className strings to add fb- prefix
        const transformedCode = transformClassNameStrings(code);
        if (transformedCode !== code) {
          return {
            code: transformedCode,
            map: null, // We could generate source maps if needed
          };
        }
      }
      return null;
    },
  };
}

/**
 * Transforms className strings in code to add fb- prefix
 * Handles both template literals and string literals in className attributes
 */
function transformClassNameStrings(code: string): string {
  // Pattern to match className attributes with string/template literals
  // Matches: className="..." or className={`...`} or className={cn(...)}
  const classNamePattern = /className\s*=\s*{?(["'`])((?:(?!\1)[^\\]|\\.)*)\1}?/g;

  return code.replace(classNamePattern, (match, quote, content) => {
    // Skip if already has fb- prefix or is a function call (like cn())
    if (content.includes("fb-") || content.includes("cn(") || content.includes("className")) {
      return match;
    }

    // Transform the className string
    const transformed = addFbPrefixToClasses(content);
    return match.replace(content, transformed);
  });
}

/**
 * Adds fb- prefix to Tailwind CSS classes
 */
function addFbPrefixToClasses(className: string): string {
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
