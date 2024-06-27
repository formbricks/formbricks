import { sync } from "glob";
import { replaceInFile } from "replace-in-file";

// Function to fix redundant fb- prefixes in TSX files
const fixRedundantPrefixes = async () => {
  try {
    // Find all .tsx files in the project recursively
    const files = sync("**/*.tsx", { ignore: "node_modules/**" });

    // Regular expressions to match class names in various patterns
    const classRegexPatterns = [
      /className="([^"]+)"/g, // Handles className="class1 class2"
      /class="([^"]+)"/g, // Handles class="class1 class2"
      /className=\{`([^`}]+)`\}/g, // Handles className={`class1 class2`}
      /className=\{cn\(\s*`([^`}]+)`\s*\)\}/g, // Handles className={cn(`class1 class2`)}
      /className=\{cn\(\s*"([^"]+)"\s*\)\}/g, // Handles className={cn("class1 class2")}
    ];

    // Function to fix the redundant prefix
    const fixPrefix = (match: string, p1: string) => {
      return match.replace(
        p1,
        p1
          .split(" ")
          .map((className) => {
            // Handle selectors like fb-focus:fb-border
            const parts = className.split(":");
            if (parts.length > 1) {
              if (parts[0].startsWith("fb-") && parts[1].startsWith("fb-")) {
                parts[0] = parts[0].slice(3); // Remove the first 'fb-'
              }
              return parts.join(":");
            } else {
              return className;
            }
          })
          .join(" ")
      );
    };

    // Function to add the prefix where needed
    const addPrefix = (match: string, p1: string) => {
      return match.replace(
        p1,
        p1
          .split(" ")
          .map((className) => {
            const parts = className.split(":");
            if (parts.length > 1) {
              if (!parts[1].startsWith("fb-")) {
                parts[1] = "fb-" + parts[1];
              }
              return parts.join(":");
            } else {
              return className.startsWith("fb-") ? className : "fb-" + className;
            }
          })
          .join(" ")
      );
    };

    // Replace class names in the found files to fix redundant prefixes
    for (const pattern of classRegexPatterns) {
      await replaceInFile({
        files,
        from: pattern,
        to: fixPrefix,
      });
    }

    // Replace class names in the found files to add missing prefixes
    for (const pattern of classRegexPatterns) {
      await replaceInFile({
        files,
        from: pattern,
        to: addPrefix,
      });
    }

    console.log("Prefixes fixed and added where necessary. Modified files:", files);
  } catch (error) {
    console.error("Error fixing and adding prefixes:", error);
  }
};

// Execute the function
fixRedundantPrefixes();
