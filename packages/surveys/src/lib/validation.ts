export const validateEmail = (email: string): boolean => {
  // ReDoS-safe email validation regex that closely matches Zod's/HTML5's permissive behavior.
  // This avoids "super-linear runtime" warnings by sticking to specific allowed characters
  // rather than negated character classes where possible, and avoiding nested quantifiers.
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

export const validateUrl = (url: string): boolean => {
  try {
    // Use URL constructor for validation
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const validatePhone = (phone: string): boolean => {
  // Match the same pattern: must start with digit or +, end with digit
  // ReDoS safe: Avoids nested repetition.
  const phoneRegex = /^[0-9+][0-9+\- ]*[0-9]$/;
  return phoneRegex.test(phone);
};
