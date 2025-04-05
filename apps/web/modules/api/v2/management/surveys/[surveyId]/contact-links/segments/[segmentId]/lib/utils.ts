export const sanitizeFields = (fields?: string): string[] | [] => {
  if (!fields) return [];

  // Split by comma and trim whitespace
  const fieldArray = fields.split(",").map((field) => field.trim());

  // Filter out potentially dangerous patterns
  return fieldArray.filter((field) => {
    if (!field) return false;

    const dangerousPatterns = [
      /[;{}()=]/,
      /['"].*['"].*['"]/,
      /\$\(/,
      /\|\|/,
      /&&/,
      /--/,
      /\/\*/,
      /\*\//,
      /\${/,
      /`/,
      /\bOR\b/i,
      /\bAND\b/i,
      /\bUNION\b/i,
      /\bSELECT\b/i,
      /\bDROP\b/i,
      /\bDELETE\b/i,
      /\bINSERT\b/i,
      /\bUPDATE\b/i,
      /\bFROM\b/i,
      /\bWHERE\b/i,
    ];

    return !dangerousPatterns.some((pattern) => pattern.test(field));
  });
};
